/**
 * Report Generator Module
 * Level 1 Analysis using Gemini Vision API
 * Generates structured findings across Visual Hierarchy, Contrast, Spacing, Alignment, and Consistency.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
// Local analyzers (used as a safe fallback when Gemini is unavailable)
const { analyzeHierarchy } = require('./hierarchyAnalyzer');
const { analyzeContrast } = require('./contrastAnalyzer');
const { analyzeSpacing } = require('./spacingAnalyzer');
const { analyzeConsistency } = require('./consistencyAnalyzer');

// Initialize Gemini (use environment variable only; no embedded defaults)
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Cache selected model name to avoid repeated probing
let cachedModelName = null;

async function autoSelectModel() {
  if (!API_KEY) return null;
  if (cachedModelName) return cachedModelName;

  // Preferred candidate model names (order matters)
  const candidates = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5',
    'gemini-1.0'
  ];

  // If SDK exposes a model-listing method, try it first
  try {
    if (typeof genAI.listModels === 'function') {
      const listRes = await genAI.listModels();
      const names = (listRes && listRes.models) ? listRes.models.map(m => m.name || m.id || m.model || '').filter(Boolean) : [];
      for (const c of candidates) {
        if (names.some(n => n.includes(c))) {
          cachedModelName = c;
          return cachedModelName;
        }
      }
    }
  } catch (e) {
    // ignore and fallback to probing
  }

  // Probe by attempting to get the model via SDK
  for (const c of candidates) {
    try {
      const m = genAI.getGenerativeModel ? genAI.getGenerativeModel({ model: c }) : null;
      // If getGenerativeModel didn't throw, select it
      cachedModelName = c;
      return cachedModelName;
    } catch (e) {
      // try next
    }
  }

  // No supported model found
  return null;
}

function calculateScore(findings) {
  const deductions = { critical: 8, high: 5, medium: 2, low: 0.5, info: 0 };
  let score = 100;
  for (const finding of findings) {
    score -= deductions[finding.severity] || 0;
  }
  return Math.max(0, Math.round(score));
}

function getGrade(score) {
  if (score >= 90) return { grade: 'A', label: 'Excellent', emoji: '🟢' };
  if (score >= 80) return { grade: 'B', label: 'Good', emoji: '🟢' };
  if (score >= 70) return { grade: 'C', label: 'Fair', emoji: '🟡' };
  if (score >= 60) return { grade: 'D', label: 'Needs Improvement', emoji: '🟠' };
  if (score >= 50) return { grade: 'E', label: 'Poor', emoji: '🔴' };
  return { grade: 'F', label: 'Critical Issues', emoji: '🔴' };
}

function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

async function generateReport(imagePath, imageInfo) {
  const startTime = Date.now();
  
  try {
    // If no API key is present, skip calling Gemini and use local analyzers instead
    if (!API_KEY) {
      console.warn('No GEMINI_API_KEY set — using local analyzers fallback for Level 1 report.');
      throw new Error('NO_GEMINI_KEY');
    }

    // Attempt to auto-select a supported model name (probe/cache)
    const selected = await autoSelectModel();
    if (!selected) {
      // No supported cloud model available — trigger fallback to local analyzers
      console.warn('No supported Gemini model detected — using local analyzers fallback.');
      throw new Error('NO_GEMINI_MODEL');
    }

    const model = genAI.getGenerativeModel({ model: selected });

    // Attempt to map format to mimeType correctly, fallback to image/jpeg
    const formatUpper = (imageInfo.format || '').toUpperCase();
    const mimeType = formatUpper === 'PNG' ? 'image/png' : 
                     formatUpper === 'WEBP' ? 'image/webp' : 'image/jpeg';

    const imagePart = fileToGenerativePart(imagePath, mimeType);

    const prompt = `
You are AIVAR Level 1, an expert UI/UX Design Review Agent.
Analyze this single screenshot and identify design issues across five specific principles:
1. Visual Hierarchy
2. Contrast (WCAG AA)
3. Spacing
4. Alignment
5. Consistency

CRITICAL INSTRUCTIONS (ZERO HALLUCINATIONS):
- Every finding must be visually verifiable in the image provided. Do not guess.
- Provide a minimum of 3 distinct design issues.
- Return ONLY a raw JSON object with no markdown formatting or backticks.

Expected JSON Structure:
{
  "findings": [ ... ]
}
`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();

    // Strip potential markdown backticks
    if (text.startsWith('```json')) text = text.replace('```json', '');
    if (text.startsWith('```')) text = text.replace('```', '');
    if (text.endsWith('```')) text = text.replace(/```$/, '');
    text = text.trim();

    const parsedData = JSON.parse(text);
    let allFindings = parsedData.findings || [];
    
    // Format findings and add IDs
    allFindings = allFindings.map((finding, index) => ({
      id: `F${String(index + 1).padStart(3, '0')}`,
      principle: finding.principle || 'Design Consistency',
      severity: finding.severity || 'medium',
      location: finding.location || 'Unknown location',
      locationBounds: "Determined via AI Vision",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      description: finding.description || '',
      userImpact: finding.userImpact || '',
      recommendation: finding.recommendation || '',
      confidence: finding.confidence || 80,
      evidence: { ai_generated: true }
    }));
    
    // Sort and calculate breakdowns
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allFindings.sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
      if (sevDiff !== 0) return sevDiff;
      return (b.confidence || 0) - (a.confidence || 0);
    });
    
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of allFindings) {
      severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
    }
    
    const principleBreakdown = {};
    for (const f of allFindings) {
      if (!principleBreakdown[f.principle]) {
        principleBreakdown[f.principle] = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      }
      principleBreakdown[f.principle].total++;
      principleBreakdown[f.principle][f.severity]++;
    }
    
    const overallScore = calculateScore(allFindings);
    const grade = getGrade(overallScore);
    const analysisTime = Date.now() - startTime;
    
    return {
      meta: {
        agent: 'AIVAR Design Review Agent (Vision AI)',
        version: '1.1.0',
        level: 1,
        analysisType: 'Single Page Design Analysis',
        timestamp: new Date().toISOString(),
        analysisTimeMs: analysisTime
      },
      image: {
        filename: imageInfo.filename,
        format: imageInfo.format,
        dimensions: "Auto-detected by Gemini",
        width: 0,
        height: 0,
        sizeBytes: imageInfo.size
      },
      summary: {
        overallScore,
        grade: grade.grade,
        gradeLabel: grade.label,
        gradeEmoji: grade.emoji,
        totalFindings: allFindings.length,
        ...severityCounts
      },
      principleBreakdown,
      findings: allFindings,
      colorPalette: [],
      metadata: {
        ai_powered: true,
        model: "gemini-1.5-pro"
      }
    };
  } catch (error) {
    // If the error was thrown intentionally due to missing key, or if the model call failed
    // fall back to local analyzers and synthesize a report from their findings.
    console.error("Gemini Vision API error or no key available:", error && error.message ? error.message : error);

    // Run local analyzers in parallel
    try {
      const [hierarchyRes, contrastRes, spacingRes, consistencyRes] = await Promise.all([
        analyzeHierarchy(imagePath),
        analyzeContrast(imagePath),
        analyzeSpacing(imagePath),
        analyzeConsistency(imagePath)
      ]);

      // Combine findings and normalize to the expected format
      let combined = [];
      const srcFindings = [hierarchyRes.findings || [], contrastRes.findings || [], spacingRes.findings || [], consistencyRes.findings || []];
      srcFindings.forEach(group => {
        group.forEach(f => combined.push(f));
      });

      // Ensure there are at least 3 findings (fill with low-info if needed)
      if (combined.length < 3) {
        combined.push({ principle: 'Visual Hierarchy', severity: 'info', location: 'Full page', description: 'No significant issues detected by automated checks', userImpact: 'None', recommendation: 'Manual review recommended', confidence: 50, evidence: {} });
      }

      // Map combined to the same structure used in the successful AI path
      let allFindings = combined.map((finding, index) => ({
        id: `F${String(index + 1).padStart(3, '0')}`,
        principle: finding.principle || 'Design Consistency',
        severity: finding.severity || 'medium',
        location: finding.location || finding.location || 'Unknown location',
        locationBounds: finding.locationBounds || finding.bounds || 'Determined via analyzer',
        bounds: finding.bounds || { x: 0, y: 0, width: 0, height: 0 },
        description: finding.description || '',
        userImpact: finding.userImpact || '',
        recommendation: finding.recommendation || '',
        confidence: finding.confidence || 65,
        evidence: finding.evidence || {}
      }));

      // Sort and compute summaries
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      allFindings.sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        if (sevDiff !== 0) return sevDiff;
        return (b.confidence || 0) - (a.confidence || 0);
      });

      const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of allFindings) severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;

      const overallScore = calculateScore(allFindings);
      const grade = getGrade(overallScore);
      const analysisTime = Date.now() - startTime;

      return {
        meta: {
          agent: 'AIVAR Design Review Agent (Local Analyzers)',
          version: '1.1.0',
          level: 1,
          analysisType: 'Single Page Design Analysis (local fallback)',
          timestamp: new Date().toISOString(),
          analysisTimeMs: analysisTime
        },
        image: {
          filename: imageInfo.filename,
          format: imageInfo.format,
          dimensions: "Auto-detected by local analyzers",
          width: 0,
          height: 0,
          sizeBytes: imageInfo.size
        },
        summary: {
          overallScore,
          grade: grade.grade,
          gradeLabel: grade.label,
          gradeEmoji: grade.emoji,
          totalFindings: allFindings.length,
          ...severityCounts
        },
        principleBreakdown: {},
        findings: allFindings,
        colorPalette: [],
        metadata: {
          ai_powered: false,
          model: 'local-analyzers'
        }
      };
    } catch (localErr) {
      console.error('Local analyzers failed:', localErr);
      throw new Error('Both Gemini and local analyzers failed: ' + (localErr && localErr.message ? localErr.message : localErr));
    }
  }
}

module.exports = { generateReport };
