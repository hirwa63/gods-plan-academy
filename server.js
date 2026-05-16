const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@godsplanacademy.rw';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const app = express();
const dataDir = path.join(__dirname, 'data');
const activitiesPath = path.join(dataDir, 'activities.json');
const commentsPath = path.join(dataDir, 'comments.json');

app.use(cors());
app.use(express.json());

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  for (const file of [activitiesPath, commentsPath]) {
    try {
      await fs.access(file);
    } catch (err) {
      await fs.writeFile(file, '[]', 'utf8');
    }
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function createMailer() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

const transporter = createMailer();

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', backend: 'God\'s Plan Academy' });
});

app.get('/api/activities', async (req, res) => {
  try {
    const activities = await readJson(activitiesPath);
    res.json({ success: true, activities });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to load activity log.' });
  }
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
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to save activity.' });
  }
});

app.post('/api/comments', async (req, res) => {
  const { sender_name, sender_email, sender_role, subject, message } = req.body;

  if (!sender_name || !sender_email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  }

  const comment = {
    id: Date.now().toString(),
    sender_name,
    sender_email,
    sender_role: sender_role || 'visitor',
    subject: subject || 'General enquiry',
    message,
    received_at: new Date().toISOString()
  };

  try {
    const comments = await readJson(commentsPath);
    comments.unshift(comment);
    if (comments.length > 500) comments.length = 500;
    await writeJson(commentsPath, comments);
  } catch (err) {
    console.error('Unable to save comment:', err);
  }

  if (!transporter) {
    return res.json({
      success: true,
      message: 'Message saved, but email delivery is not configured. Set SMTP credentials in .env.'
    });
  }

  const mailOptions = {
    from: `"God's Plan Academy Website" <${SMTP_USER}>`,
    to: ADMIN_EMAIL,
    replyTo: sender_email,
    subject: `New contact message: ${subject || 'General enquiry'}`,
    text: `Name: ${sender_name}\nEmail: ${sender_email}\nRole: ${sender_role || 'visitor'}\nSubject: ${subject || 'General enquiry'}\n\nMessage:\n${message}`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Message sent to admin successfully.' });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ success: false, message: 'Unable to send email. Please try again later.' });
  }
});

(async () => {
  await ensureDataFiles();
  app.listen(PORT, () => {
    console.log(`GPA backend running on http://localhost:${PORT}`);
    if (!transporter) {
      console.warn('SMTP credentials missing. Email delivery is disabled.');
    }
  });
})();