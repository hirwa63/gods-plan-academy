const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@godsplanacademy.rw';
const ADMIN_KEY = process.env.ADMIN_KEY || 'gpa-admin-2026';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const app = express();
const dataDir = path.join(__dirname, 'data');
const activitiesPath = path.join(dataDir, 'activities.json');
const commentsPath   = path.join(dataDir, 'comments.json');
const studentsPath   = path.join(dataDir, 'students.json');
const staffPath      = path.join(dataDir, 'staff.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── Helpers ──────────────────────────────────────────────────
async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  for (const file of [activitiesPath, commentsPath, studentsPath, staffPath]) {
    try { await fs.access(file); } catch { await fs.writeFile(file, '[]', 'utf8'); }
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
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const transporter = createMailer();

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

// ── Comments / Contact ────────────────────────────────────────
app.post('/api/comments', async (req, res) => {
  const { sender_name, sender_email, sender_role, subject, message } = req.body;
  if (!sender_name || !sender_email || !message)
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });

  const comment = {
    id: Date.now().toString(), sender_name, sender_email,
    sender_role: sender_role || 'visitor',
    subject: subject || 'General enquiry',
    message, received_at: new Date().toISOString()
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
  app.listen(PORT, () => {
    console.log(`GPA backend running on http://localhost:${PORT}`);
    if (!transporter) console.warn('SMTP credentials missing. Email delivery is disabled.');
  });
})();
