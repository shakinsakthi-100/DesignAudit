const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3002;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Utility: verify JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'User already exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash: hash } });
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Level 1 – single screenshot analysis
app.post('/api/level1', authMiddleware, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Missing screenshot' });
  const imgPath = req.file.path;
  // Call detector via python
  const py = spawn('python', [path.join(__dirname, '..', 'analysis', 'detector.py'), '--image', imgPath]);
  let stdout = '';
  let stderr = '';
  py.stdout.on('data', d => stdout += d.toString());
  py.stderr.on('data', d => stderr += d.toString());
  py.on('close', code => {
    fs.unlinkSync(imgPath); // cleanup
    if (code !== 0) return res.status(500).json({ error: 'Python error', details: stderr });
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON from Python', raw: stdout });
    }
  });
});

// Level 2 – regression analysis (baseline + current)
app.post('/api/level2', authMiddleware, upload.fields([{ name: 'baseline' }, { name: 'current' }]), async (req, res) => {
  const baseline = req.files['baseline']?.[0];
  const current = req.files['current']?.[0];
  if (!baseline || !current) return res.status(400).json({ error: 'Both baseline and current required' });
  const args = [
    path.join(__dirname, '..', 'analysis', 'run_regression.py'),
    '--baseline', baseline.path,
    '--current', current.path,
    '--output_annotated', path.join(__dirname, 'uploads', `annotated-${Date.now()}.png`)
  ];
  // optional API key for Gemini
  if (process.env.GEMINI_API_KEY) args.push('--api_key', process.env.GEMINI_API_KEY);
  const py = spawn('python', args);
  let out = '';
  let err = '';
  py.stdout.on('data', d => out += d.toString());
  py.stderr.on('data', d => err += d.toString());
  py.on('close', code => {
    // cleanup uploads
    fs.unlinkSync(baseline.path);
    fs.unlinkSync(current.path);
    if (code !== 0) return res.status(500).json({ error: 'Regression script failed', details: err });
    try {
      const report = JSON.parse(out);
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON from regression', raw: out });
    }
  });
});

// Level 3 – autonomous site audit
app.post('/api/level3', authMiddleware, async (req, res) => {
  const { baselineUrls, currentUrls, login } = req.body; // arrays of URLs, optional login credentials
  // For simplicity expect exactly one pair
  const baselineUrl = baselineUrls?.[0];
  const currentUrl = currentUrls?.[0];
  if (!baselineUrl || !currentUrl) return res.status(400).json({ error: 'Baseline and current URLs required' });
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const { runAutonomousAudit } = require(path.join(__dirname, '..', 'analysis', 'crawler'));
  runAutonomousAudit(baselineUrl, currentUrl, uploadsDir)
    .then(({ baselinePath, currentPath }) => {
      // reuse Level 2 regression logic
      const args = [
        path.join(__dirname, '..', 'analysis', 'run_regression.py'),
        '--baseline', baselinePath,
        '--current', currentPath,
        '--output_annotated', path.join(uploadsDir, `annotated-${Date.now()}.png`)
      ];
      if (process.env.GEMINI_API_KEY) args.push('--api_key', process.env.GEMINI_API_KEY);
      const py = spawn('python', args);
      let out = '';
      let err = '';
      py.stdout.on('data', d => out += d.toString());
      py.stderr.on('data', d => err += d.toString());
      py.on('close', code => {
        // cleanup screenshots
        fs.unlinkSync(baselinePath);
        fs.unlinkSync(currentPath);
        if (code !== 0) return res.status(500).json({ error: 'Regression part failed', details: err });
        try {
          const report = JSON.parse(out);
          // Persist report in DB
          prisma.auditReport.create({
            data: {
              userId: req.user.id,
              level: 3,
              reportJson: JSON.stringify(report),
              annotatedImagePath: report.annotatedImageUrl || ''
            }
          }).catch(console.error);
          res.json(report);
        } catch (e) {
          res.status(500).json({ error: 'Invalid JSON from regression', raw: out });
        }
      });
    })
    .catch(err => {
      res.status(500).json({ error: 'Crawler error', details: err.message || err });
    });
});

// Simple health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`\n🚀 AIVAR Backend listening on http://localhost:${PORT}`);
});
