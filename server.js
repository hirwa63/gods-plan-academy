const express  = require('express');
const cors     = require('cors');
const nodemailer = require('nodemailer');
const multer   = require('multer');
const fs       = require('fs').promises;
const fss      = require('fs');
const path     = require('path');
const dotenv   = require('dotenv');

dotenv.config();

const PORT       = process.env.PORT       || 3000;
const ADMIN_EMAIL= process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim() : 'admin@godsplanacademy.rw';
const ADMIN_KEY  = process.env.ADMIN_KEY  || 'gpa-admin-2026';
const SMTP_HOST  = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : undefined;
const SMTP_PORT  = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE= process.env.SMTP_SECURE === 'true';
const SMTP_USER  = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : undefined;
const SMTP_PASS  = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s/g, '') : undefined;

const app      = express();
const dataDir  = path.join(__dirname, 'data');
const uploadDir= path.join(__dirname, 'uploads');

const activitiesPath    = path.join(dataDir, 'activities.json');
const commentsPath      = path.join(dataDir, 'comments.json');
const studentsPath      = path.join(dataDir, 'students.json');
const staffPath         = path.join(dataDir, 'staff.json');
const announcementsPath = path.join(dataDir, 'announcements.json');
const galleryPath       = path.join(dataDir, 'gallery.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

// ── File upload (multer) ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

// ── Helpers ───────────────────────────────────────────────────
async function ensureDataFiles() {
  if (!fss.existsSync(uploadDir)) fss.mkdirSync(uploadDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  const files = [activitiesPath, commentsPath, studentsPath, staffPath,
                 announcementsPath, galleryPath];
  for (const f of files) {
    try { await fs.access(f); } catch { await fs.writeFile(f, '[]', 'utf8'); }
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function isAdmin(req) {
  return req.headers['x-admin-key'] === ADMIN_KEY;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin access required.' });
  next();
}

function createMailer() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}
const transporter = createMailer();

async function verifyMailer() {
  if (!transporter) return false;
  try {
    await transporter.verify();
    return true;
  } catch (err) {
    console.error('SMTP verification failed:', err.message || err);
    return false;
  }
}

// Auto-update announcement statuses based on dates
function syncAnnouncementStatuses(list) {
  const now = new Date();
  let changed = false;
  list.forEach(a => {
    if (a.status === 'scheduled' && new Date(a.publishDate) <= now) {
      a.status = 'published'; changed = true;
    }
    if (a.status === 'published' && a.expiryDate && new Date(a.expiryDate) <= now) {
      a.status = 'archived'; changed = true;
    }
  });
  return changed;
}

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', backend: "God's Plan Academy" });
});

// ── Activities ────────────────────────────────────────────────
app.get('/api/activities', async (req, res) => {
  try { res.json({ success: true, activities: await readJson(activitiesPath) }); }
  catch { res.status(500).json({ success: false, message: 'Unable to load activity log.' }); }
});

app.post('/api/activities', async (req, res) => {
  try {
    const activity = {
      timestamp: new Date().toISOString(),
      user: req.body.user || 'guest',
      action: req.body.action || 'unknown',
      details: req.body.details || ''
    };
    const activities = await readJson(activitiesPath);
    activities.unshift(activity);
    if (activities.length > 200) activities.length = 200;
    await writeJson(activitiesPath, activities);
    res.json({ success: true, activity });
  } catch { res.status(500).json({ success: false, message: 'Unable to save activity.' }); }
});

// ── Students ──────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  try {
    const students = await readJson(studentsPath);
    const { cls } = req.query;
    res.json({ success: true, students: cls ? students.filter(s => s.cls === cls) : students });
  } catch { res.status(500).json({ success: false, message: 'Unable to load students.' }); }
});

app.post('/api/students', requireAdmin, async (req, res) => {
  try {
    const students = await readJson(studentsPath);
    const student = { ...req.body };
    if (!student.reg || !student.name) return res.status(400).json({ success: false, message: 'reg and name are required.' });
    if (students.find(s => s.reg === student.reg)) return res.status(400).json({ success: false, message: 'Registration number already exists.' });
    students.push(student);
    await writeJson(studentsPath, students);
    res.json({ success: true, student });
  } catch { res.status(500).json({ success: false, message: 'Unable to add student.' }); }
});

app.put('/api/students/:reg', requireAdmin, async (req, res) => {
  try {
    const students = await readJson(studentsPath);
    const idx = students.findIndex(s => s.reg === req.params.reg);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Student not found.' });
    students[idx] = { ...students[idx], ...req.body };
    await writeJson(studentsPath, students);
    res.json({ success: true, student: students[idx] });
  } catch { res.status(500).json({ success: false, message: 'Unable to update student.' }); }
});

app.delete('/api/students/:reg', requireAdmin, async (req, res) => {
  try {
    let students = await readJson(studentsPath);
    const before = students.length;
    students = students.filter(s => s.reg !== req.params.reg);
    if (students.length === before) return res.status(404).json({ success: false, message: 'Student not found.' });
    await writeJson(studentsPath, students);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to delete student.' }); }
});

// ── Staff ─────────────────────────────────────────────────────
app.get('/api/staff', async (req, res) => {
  try { res.json({ success: true, staff: await readJson(staffPath) }); }
  catch { res.status(500).json({ success: false, message: 'Unable to load staff.' }); }
});

app.post('/api/staff', requireAdmin, async (req, res) => {
  try {
    const staff = await readJson(staffPath);
    const member = { ...req.body };
    if (!member.id || !member.name) return res.status(400).json({ success: false, message: 'id and name are required.' });
    if (staff.find(s => s.id === member.id)) return res.status(400).json({ success: false, message: 'Staff ID already exists.' });
    staff.push(member);
    await writeJson(staffPath, staff);
    res.json({ success: true, member });
  } catch { res.status(500).json({ success: false, message: 'Unable to add staff.' }); }
});

app.put('/api/staff/:id', requireAdmin, async (req, res) => {
  try {
    const staff = await readJson(staffPath);
    const idx = staff.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    staff[idx] = { ...staff[idx], ...req.body };
    await writeJson(staffPath, staff);
    res.json({ success: true, member: staff[idx] });
  } catch { res.status(500).json({ success: false, message: 'Unable to update staff.' }); }
});

app.delete('/api/staff/:id', requireAdmin, async (req, res) => {
  try {
    let staff = await readJson(staffPath);
    const before = staff.length;
    staff = staff.filter(s => s.id !== req.params.id);
    if (staff.length === before) return res.status(404).json({ success: false, message: 'Staff member not found.' });
    await writeJson(staffPath, staff);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to delete staff.' }); }
});

// ── Announcements ─────────────────────────────────────────────
app.get('/api/announcements', async (req, res) => {
  try {
    const list = await readJson(announcementsPath);
    const changed = syncAnnouncementStatuses(list);
    if (changed) await writeJson(announcementsPath, list);

    const { status } = req.query;
    let result = isAdmin(req) ? list : list.filter(a => a.status === 'published');
    if (status) result = result.filter(a => a.status === status);

    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.publishDate) - new Date(a.publishDate);
    });
    res.json({ success: true, announcements: result });
  } catch { res.status(500).json({ success: false, message: 'Unable to load announcements.' }); }
});

app.post('/api/announcements', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const list = await readJson(announcementsPath);
    const now = new Date();
    const publishDate = req.body.publishDate ? new Date(req.body.publishDate) : now;
    const status = req.body.status || (publishDate <= now ? 'published' : 'scheduled');
    const ann = {
      id: 'ann_' + Date.now(),
      title: req.body.title || 'Untitled',
      content: req.body.content || '',
      category: req.body.category || 'general',
      image: req.file ? '/uploads/' + req.file.filename : null,
      publishDate: publishDate.toISOString(),
      expiryDate: req.body.expiryDate || null,
      status,
      pinned: req.body.pinned === 'true',
      createdBy: req.body.createdBy || 'admin',
      createdAt: now.toISOString()
    };
    list.unshift(ann);
    await writeJson(announcementsPath, list);
    res.json({ success: true, announcement: ann });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/announcements/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const list = await readJson(announcementsPath);
    const idx = list.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    const updated = { ...list[idx] };
    ['title','content','category','publishDate','expiryDate','status','createdBy'].forEach(k => {
      if (req.body[k] !== undefined) updated[k] = req.body[k];
    });
    if (req.body.pinned !== undefined) updated.pinned = req.body.pinned === 'true';
    if (req.file) {
      if (!updated.imageHistory) updated.imageHistory = [];
      if (updated.image) updated.imageHistory.unshift({ url: updated.image, savedAt: new Date().toISOString() });
      updated.image = '/uploads/' + req.file.filename;
    }
    list[idx] = updated;
    await writeJson(announcementsPath, list);
    res.json({ success: true, announcement: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  try {
    let list = await readJson(announcementsPath);
    const before = list.length;
    list = list.filter(a => a.id !== req.params.id);
    if (list.length === before) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    await writeJson(announcementsPath, list);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to delete announcement.' }); }
});

// ── Gallery Posts ─────────────────────────────────────────────
app.get('/api/gallery', async (req, res) => {
  try {
    const posts = await readJson(galleryPath);
    res.json({ success: true, posts });
  } catch { res.status(500).json({ success: false, message: 'Unable to load gallery.' }); }
});

app.post('/api/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const posts = await readJson(galleryPath);
    const post = {
      id: 'gal_' + Date.now(),
      title: req.body.title || 'Untitled',
      caption: req.body.caption || '',
      category: req.body.category || 'general',
      image: req.file ? '/uploads/' + req.file.filename : null,
      publishedAt: new Date().toISOString(),
      createdBy: req.body.createdBy || 'admin',
      comments: []
    };
    posts.unshift(post);
    await writeJson(galleryPath, posts);
    res.json({ success: true, post });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/gallery/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const posts = await readJson(galleryPath);
    const idx = posts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Post not found.' });
    const updated = { ...posts[idx], ...req.body };
    if (req.file) {
      if (!updated.imageHistory) updated.imageHistory = [];
      if (updated.image) updated.imageHistory.unshift({ url: updated.image, savedAt: new Date().toISOString() });
      updated.image = '/uploads/' + req.file.filename;
    }
    posts[idx] = updated;
    await writeJson(galleryPath, posts);
    res.json({ success: true, post: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.patch('/api/gallery/:id/restore-image', requireAdmin, async (req, res) => {
  try {
    const posts = await readJson(galleryPath);
    const idx = posts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Post not found.' });
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ success: false, message: 'imageUrl is required.' });
    const post = { ...posts[idx] };
    if (!post.imageHistory) post.imageHistory = [];
    if (post.image) post.imageHistory.unshift({ url: post.image, savedAt: new Date().toISOString() });
    post.imageHistory = post.imageHistory.filter(h => h.url !== imageUrl);
    post.image = imageUrl;
    posts[idx] = post;
    await writeJson(galleryPath, posts);
    res.json({ success: true, post });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/gallery/:id', requireAdmin, async (req, res) => {
  try {
    let posts = await readJson(galleryPath);
    const before = posts.length;
    posts = posts.filter(p => p.id !== req.params.id);
    if (posts.length === before) return res.status(404).json({ success: false, message: 'Post not found.' });
    await writeJson(galleryPath, posts);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to delete post.' }); }
});

// Comments on gallery posts
app.post('/api/gallery/:id/comments', async (req, res) => {
  const { name, text } = req.body;
  if (!name || !text) return res.status(400).json({ success: false, message: 'Name and comment text are required.' });
  try {
    const posts = await readJson(galleryPath);
    const idx = posts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Post not found.' });
    const comment = { id: Date.now().toString(), name, text, date: new Date().toISOString() };
    if (!posts[idx].comments) posts[idx].comments = [];
    posts[idx].comments.push(comment);
    await writeJson(galleryPath, posts);
    res.json({ success: true, comment });
  } catch { res.status(500).json({ success: false, message: 'Unable to save comment.' }); }
});

// ── Contact / Comments ────────────────────────────────────────
app.get('/api/comments', requireAdmin, async (req, res) => {
  try { res.json({ success: true, comments: await readJson(commentsPath) }); }
  catch { res.status(500).json({ success: false, message: 'Unable to load messages.' }); }
});

app.patch('/api/comments/:id/read', requireAdmin, async (req, res) => {
  try {
    const comments = await readJson(commentsPath);
    const idx = comments.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Message not found.' });
    comments[idx].read = true;
    await writeJson(commentsPath, comments);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to update message.' }); }
});

app.delete('/api/comments/:id', requireAdmin, async (req, res) => {
  try {
    let comments = await readJson(commentsPath);
    const before = comments.length;
    comments = comments.filter(c => c.id !== req.params.id);
    if (comments.length === before) return res.status(404).json({ success: false, message: 'Message not found.' });
    await writeJson(commentsPath, comments);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to delete message.' }); }
});

app.post('/api/comments', async (req, res) => {
  const { sender_name, sender_email, sender_role, subject, message } = req.body;
  if (!sender_name || !sender_email || !message)
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });

  const comment = {
    id: Date.now().toString(), sender_name, sender_email,
    sender_role: sender_role || 'visitor',
    subject: subject || 'General enquiry',
    message, received_at: new Date().toISOString(),
    read: false
  };

  try {
    const comments = await readJson(commentsPath);
    comments.unshift(comment);
    if (comments.length > 500) comments.length = 500;
    await writeJson(commentsPath, comments);
  } catch (err) { console.error('Unable to save comment:', err); }

  if (!transporter)
    return res.json({ success: true, message: 'Message saved (email delivery not configured).' });

  try {
    await transporter.sendMail({
      from: `"God's Plan Academy Website" <${SMTP_USER}>`,
      to: ADMIN_EMAIL, replyTo: sender_email,
      subject: `New contact message: ${subject || 'General enquiry'}`,
      text: `Name: ${sender_name}\nEmail: ${sender_email}\nRole: ${sender_role || 'visitor'}\nSubject: ${subject || 'General enquiry'}\n\nMessage:\n${message}`
    });
    res.json({ success: true, message: 'Message sent to admin successfully.' });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ success: false, message: 'Unable to send email. Please try again later.' });
  }
});

// ── Start ─────────────────────────────────────────────────────
(async () => {
  await ensureDataFiles();
  app.listen(PORT, async () => {
    console.log(`\n🌱 God's Plan Academy backend → http://localhost:${PORT}`);
    console.log(`   Students API : http://localhost:${PORT}/api/students`);
    console.log(`   Announcements: http://localhost:${PORT}/api/announcements`);
    console.log(`   Gallery      : http://localhost:${PORT}/api/gallery`);

    if (!transporter) {
      console.warn('   ⚠️  SMTP credentials missing — email disabled. Check your .env file.');
      return;
    }

    const smtpOk = await verifyMailer();
    if (smtpOk) {
      console.log('   ✅ SMTP is configured and ready to send emails.');
    } else {
      console.warn('   ⚠️  SMTP configuration is invalid or blocked. Contact form emails will fail until corrected.');
    }
  });
})();
