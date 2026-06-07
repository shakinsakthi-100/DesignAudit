/**
 * AIVAR Design Review Agent — Express Server
 * Serves the chatbot frontend and provides the /api/analyze endpoint
 * for screenshot analysis.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { generateReport } = require('./analysis/reportGenerator');
const { runAutonomousAudit } = require('./analysis/crawler');

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize Gemini SDK for debug endpoints (use env key only)
let genAIClient = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || '';
  genAIClient = new GoogleGenerativeAI(apiKey);
} catch (e) {
  // Ignore if SDK not available
  console.warn('Generative AI SDK not available for debug endpoints');
}
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `screenshot-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload PNG, JPG, or WebP images.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: 'AIVAR Design Review Agent',
    version: '1.0.0',
    level: 1,
    capabilities: [
      'Visual Hierarchy Analysis',
      'WCAG AA Contrast Checking',
      'Spacing Consistency',
      'Alignment Detection',
      'Design Consistency'
    ]
  });
});

// Debug endpoint: list available Gemini models (requires valid GEMINI_API_KEY)
app.get('/api/debug/models', async (req, res) => {
  if (!genAIClient) return res.status(500).json({ error: 'Generative AI SDK not installed' });
  try {
    if (typeof genAIClient.listModels === 'function') {
      const list = await genAIClient.listModels();
      return res.json({ ok: true, models: list });
    }

    // If SDK doesn't expose listModels, try probing some common model names
    const candidates = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5', 'gemini-1.0'];
    const available = [];
    for (const c of candidates) {
      try {
        // Some SDKs allow getGenerativeModel without network call — attempt it
        if (typeof genAIClient.getGenerativeModel === 'function') {
          genAIClient.getGenerativeModel({ model: c });
          available.push(c);
        }
      } catch (e) {
        // ignore
      }
    }
    return res.json({ ok: true, probed: available });
  } catch (err) {
    return res.status(500).json({ error: 'Model listing failed', details: String(err) });
  }
});

// Main analysis endpoint
app.post('/api/analyze', upload.single('screenshot'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No image provided',
      message: 'Please upload a screenshot (PNG, JPG, or WebP format, max 10MB)'
    });
  }

  const imagePath = req.file.path;

  try {
    console.log(`[AIVAR] Analyzing: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)}KB)`);

    const imageInfo = {
      filename: req.file.originalname,
      format: req.file.mimetype.split('/')[1].toUpperCase(),
      size: req.file.size
    };

    const report = await generateReport(imagePath, imageInfo);

    console.log(`[AIVAR] Analysis complete: ${report.summary.totalFindings} findings, score: ${report.summary.overallScore}/100 (${report.summary.gradeLabel}) in ${report.meta.analysisTimeMs}ms`);

    res.json(report);
  } catch (error) {
    console.error('[AIVAR] Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message || 'An unexpected error occurred during image analysis'
    });
  } finally {
    // Clean up uploaded file after analysis
    try {
      fs.unlinkSync(imagePath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});

// Regression analysis endpoint (Level 2)
app.post('/api/analyze-regression', upload.fields([
  { name: 'baseline', maxCount: 1 },
  { name: 'current', maxCount: 1 }
]), async (req, res) => {
  const files = req.files;
  if (!files || !files.baseline || !files.current) {
    return res.status(400).json({
      error: 'Missing images',
      message: 'Please upload both baseline and current screenshots.'
    });
  }

  const baselinePath = files.baseline[0].path;
  const currentPath = files.current[0].path;

  // Read body arguments
  const apiKey = process.env.OPENAI_API_KEY || '';
  const diffThreshold = req.body.diffThreshold || 15;
  const minArea = req.body.minArea || 80;

  // Output annotated path
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const annotatedFilename = `annotated-${uniqueSuffix}.png`;
  const annotatedPath = path.join(uploadsDir, annotatedFilename);

  console.log(`[AIVAR] Running regression audit: ${files.baseline[0].originalname} vs ${files.current[0].originalname}`);

  // Spawn run_regression.py CLI
  const args = [
    path.join(__dirname, 'analysis', 'run_regression.py'),
    '--baseline', baselinePath,
    '--current', currentPath,
    '--output_annotated', annotatedPath,
    '--diff_threshold', String(diffThreshold),
    '--min_area', String(minArea)
  ];

  if (apiKey) {
    args.push('--api_key', apiKey);
  }

  const pythonProcess = spawn('python', args);

  let stdoutData = '';
  let stderrData = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  pythonProcess.on('close', (code) => {
    // Clean up uploaded temp files
    try {
      fs.unlinkSync(baselinePath);
      fs.unlinkSync(currentPath);
    } catch (e) {
      // Ignore
    }

    if (code !== 0) {
      console.error(`[AIVAR] run_regression.py failed with code ${code}. Error: ${stderrData}`);
      return res.status(500).json({
        error: 'Analysis failed',
        message: stderrData || `CLI failed with exit code ${code}`
      });
    }

    try {
      const report = JSON.parse(stdoutData);
      
      if (report.error) {
        return res.status(500).json({
          error: 'Analysis failed',
          message: report.error
        });
      }

      // Add relative URL to response
      report.annotatedImageUrl = `/uploads/${annotatedFilename}`;
      res.json(report);

    } catch (err) {
      console.error('[AIVAR] Failed to parse JSON report output:', err, stdoutData);
      res.status(500).json({
        error: 'Analysis output error',
        message: 'The analysis completed but returned an invalid format.'
      });
    }
  });
});

// Level 3: Autonomous Web Crawler Endpoint
app.post('/api/audit-site', async (req, res) => {
  const baselineUrl = req.body.baselineUrl || req.body.url;
  const currentUrl = req.body.currentUrl || req.body.url;

  if (!baselineUrl || !currentUrl) {
    return res.status(400).json({ error: 'Missing URLs', message: 'Please provide both baselineUrl and currentUrl (or a single url) in the request body.' });
  }

  try {
    // 1. Crawl and capture screenshots
    console.log(`[AIVAR] Level 3 Audit started: ${baselineUrl} vs ${currentUrl}`);
    const { baselinePath, currentPath } = await runAutonomousAudit(baselineUrl, currentUrl, uploadsDir);

    // 2. Run Regression Analysis (Level 2)
    // Use GEMINI_API_KEY from environment only. Do NOT fall back to an embedded/default key.
    const apiKey = process.env.GEMINI_API_KEY || '';
    const diffThreshold = req.body.diffThreshold || 15;
    const minArea = req.body.minArea || 80;

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const annotatedFilename = `annotated-${uniqueSuffix}.png`;
    const annotatedPath = path.join(uploadsDir, annotatedFilename);

    const args = [
      path.join(__dirname, 'analysis', 'run_regression.py'),
      '--baseline', baselinePath,
      '--current', currentPath,
      '--output_annotated', annotatedPath,
      '--diff_threshold', String(diffThreshold),
      '--min_area', String(minArea)
    ];

    if (apiKey) {
      args.push('--api_key', apiKey);
    }

    const pythonProcess = spawn('python', args);
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderrData += data.toString(); });

    pythonProcess.on('close', (code) => {
      // Cleanup crawler screenshots
      try {
        fs.unlinkSync(baselinePath);
        fs.unlinkSync(currentPath);
      } catch (e) {}

      if (code !== 0) {
        return res.status(500).json({ error: 'Audit failed', message: stderrData });
      }

      try {
        const report = JSON.parse(stdoutData);
        report.annotatedImageUrl = `/uploads/${annotatedFilename}`;
        res.json(report);
      } catch (err) {
        res.status(500).json({ error: 'Audit output error', message: 'Failed to parse JSON report.' });
      }
    });

  } catch (error) {
    console.error('[AIVAR] Crawler error:', error);
    res.status(500).json({ error: 'Crawler failed', message: error.message });
  }
});


// Error handling middleware for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 10MB. Please compress or resize your screenshot.'
      });
    }
    return res.status(400).json({ error: 'Upload error', message: err.message });
  }
  if (err) {
    return res.status(400).json({ error: 'Upload error', message: err.message });
  }
  next();
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║    🔍 AIVAR Design Review Agent v1.0                 ║
║    ─────────────────────────────────────              ║
║    Level 1: Single Page Design Analysis              ║
║                                                      ║
║    Server running at: http://localhost:${PORT}          ║
║                                                      ║
║    Principles: Hierarchy · Contrast · Spacing        ║
║                Alignment · Consistency               ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
