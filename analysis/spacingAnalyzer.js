/**
 * Spacing Analyzer Module
 * Detects content bands in the image and measures vertical/horizontal spacing.
 * Flags inconsistent gaps between content regions.
 */

const { createCanvas, loadImage } = require('./canvas');

/**
 * Convert a pixel row/column to grayscale average and variance
 */
function analyzeStrip(imageData, width, height, index, isRow) {
  let sum = 0;
  let sqSum = 0;
  let count = 0;

  if (isRow) {
    // Analyze a horizontal row
    for (let x = 0; x < width; x++) {
      const i = (index * width + x) * 4;
      const gray = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
      sum += gray;
      sqSum += gray * gray;
      count++;
    }
  } else {
    // Analyze a vertical column
    for (let y = 0; y < height; y++) {
      const i = (y * width + index) * 4;
      const gray = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
      sum += gray;
      sqSum += gray * gray;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sqSum / count - mean * mean;
  return { mean, variance };
}

/**
 * Detect content bands — regions where pixel variance is high (indicates content)
 * vs gap bands — regions of uniform color (indicates spacing)
 */
function detectBands(stripStats, threshold = 150) {
  const bands = [];
  let inContent = false;
  let bandStart = 0;

  for (let i = 0; i < stripStats.length; i++) {
    const isContent = stripStats[i].variance > threshold;
    if (isContent && !inContent) {
      bandStart = i;
      inContent = true;
    } else if (!isContent && inContent) {
      bands.push({ type: 'content', start: bandStart, end: i - 1, size: i - bandStart });
      inContent = false;
      bandStart = i;
    }
  }

  if (inContent) {
    bands.push({ type: 'content', start: bandStart, end: stripStats.length - 1, size: stripStats.length - bandStart });
  }

  // Now find gaps between content bands
  const gaps = [];
  for (let i = 1; i < bands.length; i++) {
    const gapStart = bands[i - 1].end + 1;
    const gapEnd = bands[i].start - 1;
    const gapSize = gapEnd - gapStart + 1;
    if (gapSize > 2) { // Ignore sub-pixel gaps
      gaps.push({ start: gapStart, end: gapEnd, size: gapSize });
    }
  }

  return { contentBands: bands, gaps };
}

/**
 * Analyze spacing consistency
 */
async function analyzeSpacing(imagePath) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
  const findings = [];

  // Analyze vertical spacing (row by row)
  const rowStats = [];
  for (let y = 0; y < img.height; y++) {
    rowStats.push(analyzeStrip(imageData, img.width, img.height, y, true));
  }
  const verticalBands = detectBands(rowStats);

  // Analyze horizontal spacing (column by column)
  const colStats = [];
  for (let x = 0; x < img.width; x++) {
    colStats.push(analyzeStrip(imageData, img.width, img.height, x, false));
  }
  const horizontalBands = detectBands(colStats);

  // Check vertical gap consistency
  if (verticalBands.gaps.length >= 2) {
    const gapSizes = verticalBands.gaps.map(g => g.size);
    const avgGap = gapSizes.reduce((a, b) => a + b, 0) / gapSizes.length;
    const maxDeviation = Math.max(...gapSizes.map(g => Math.abs(g - avgGap)));

    if (maxDeviation > avgGap * 0.4 && maxDeviation > 8) {
      // Find the most inconsistent gap
      let worstGap = verticalBands.gaps[0];
      let worstDeviation = 0;
      for (const gap of verticalBands.gaps) {
        const dev = Math.abs(gap.size - avgGap);
        if (dev > worstDeviation) {
          worstDeviation = dev;
          worstGap = gap;
        }
      }

      const yZone = worstGap.start < img.height * 0.33 ? 'Top' : worstGap.start < img.height * 0.66 ? 'Middle' : 'Bottom';

      findings.push({
        principle: 'Spacing',
        severity: maxDeviation > avgGap * 0.8 ? 'high' : 'medium',
        location: `${yZone} section, vertical gap at y:${worstGap.start}-${worstGap.end}px`,
        bounds: { x: 0, y: worstGap.start, width: img.width, height: Math.max(2, worstGap.end - worstGap.start) },
        description: `Inconsistent vertical spacing detected: gap of ${worstGap.size}px deviates significantly from the average gap of ${Math.round(avgGap)}px (${Math.round(worstDeviation)}px deviation)`,
        userImpact: 'Inconsistent spacing creates visual tension and makes the page feel unpolished, reducing user trust and perceived quality',
        recommendation: `Standardize vertical spacing to ${Math.round(avgGap)}px (or a multiple of your base spacing unit, e.g., 8px grid: ${Math.round(avgGap / 8) * 8}px). Adjust the gap at y:${worstGap.start}px to match other gaps.`,
        confidence: Math.min(85, Math.round(50 + Math.min(35, maxDeviation / avgGap * 40))),
        evidence: {
          gapSizes: gapSizes.map(g => `${g}px`),
          averageGap: `${Math.round(avgGap)}px`,
          worstDeviation: `${Math.round(worstDeviation)}px`,
          location: `y:${worstGap.start}-${worstGap.end}px`
        }
      });
    }

    // Check if spacing follows an 8px grid (common design standard)
    const offGrid = gapSizes.filter(g => g % 8 > 2 && g % 8 < 6);
    if (offGrid.length > gapSizes.length * 0.5 && gapSizes.length >= 3) {
      findings.push({
        principle: 'Spacing',
        severity: 'low',
        location: 'Multiple sections across the page',
        bounds: { x: 0, y: 0, width: img.width, height: img.height },
        description: `Vertical spacing values (${gapSizes.map(g => g + 'px').join(', ')}) do not follow an 8px grid system, which is a widely adopted spacing standard`,
        userImpact: 'Non-systematic spacing creates subtle visual disharmony and makes future design iterations harder to maintain',
        recommendation: `Adopt an 8px spacing grid. Round current gaps to nearest 8px multiples: ${gapSizes.map(g => Math.round(g / 8) * 8 + 'px').join(', ')}`,
        confidence: 55,
        evidence: {
          currentSpacing: gapSizes.map(g => `${g}px`),
          suggestedSpacing: gapSizes.map(g => `${Math.round(g / 8) * 8}px`),
          gridBase: '8px'
        }
      });
    }
  }

  // Check horizontal gap consistency (e.g., columns, card layouts)
  if (horizontalBands.gaps.length >= 2) {
    const hGapSizes = horizontalBands.gaps.map(g => g.size);
    const hAvgGap = hGapSizes.reduce((a, b) => a + b, 0) / hGapSizes.length;
    const hMaxDeviation = Math.max(...hGapSizes.map(g => Math.abs(g - hAvgGap)));

    if (hMaxDeviation > hAvgGap * 0.4 && hMaxDeviation > 10) {
      let worstGap = horizontalBands.gaps[0];
      let worstDeviation = 0;
      for (const gap of horizontalBands.gaps) {
        const dev = Math.abs(gap.size - hAvgGap);
        if (dev > worstDeviation) {
          worstDeviation = dev;
          worstGap = gap;
        }
      }

      const xZone = worstGap.start < img.width * 0.33 ? 'Left' : worstGap.start < img.width * 0.66 ? 'Center' : 'Right';

      findings.push({
        principle: 'Spacing',
        severity: 'medium',
        location: `${xZone} area, horizontal gap at x:${worstGap.start}-${worstGap.end}px`,
        bounds: { x: worstGap.start, y: 0, width: Math.max(2, worstGap.end - worstGap.start), height: img.height },
        description: `Inconsistent horizontal spacing: gap of ${worstGap.size}px vs average ${Math.round(hAvgGap)}px (${Math.round(worstDeviation)}px deviation)`,
        userImpact: 'Uneven horizontal spacing disrupts content scanning patterns and can make card/column layouts feel unbalanced',
        recommendation: `Normalize horizontal gaps to ${Math.round(hAvgGap)}px. Check if columns or cards have equal gutters.`,
        confidence: Math.min(80, Math.round(45 + Math.min(35, worstDeviation / hAvgGap * 40))),
        evidence: {
          gapSizes: hGapSizes.map(g => `${g}px`),
          averageGap: `${Math.round(hAvgGap)}px`,
          worstDeviation: `${Math.round(worstDeviation)}px`
        }
      });
    }
  }

  // Check for cramped content (very small gaps)
  const allGaps = [...verticalBands.gaps, ...horizontalBands.gaps];
  const tinyGaps = allGaps.filter(g => g.size < 6 && g.size > 0);
  if (tinyGaps.length > 2) {
    // Find the first tiny gap bounds
    const firstTiny = tinyGaps[0];
    const isVertical = verticalBands.gaps.includes(firstTiny);
    const bounds = isVertical
      ? { x: 0, y: firstTiny.start, width: img.width, height: Math.max(2, firstTiny.end - firstTiny.start) }
      : { x: firstTiny.start, y: 0, width: Math.max(2, firstTiny.end - firstTiny.start), height: img.height };

    findings.push({
      principle: 'Spacing',
      severity: 'medium',
      location: 'Multiple areas across the page',
      bounds: bounds,
      description: `${tinyGaps.length} content regions have gaps smaller than 6px, creating a cramped appearance`,
      userImpact: 'Insufficient spacing between elements makes content harder to scan and increases cognitive load, especially on mobile devices',
      recommendation: 'Ensure minimum 8px spacing between distinct content blocks. Consider 12-16px for section separators.',
      confidence: 65,
      evidence: {
        tinyGapCount: tinyGaps.length,
        gapLocations: tinyGaps.slice(0, 4).map(g => `${g.start}-${g.end}px (${g.size}px)`)
      }
    });
  }

  return {
    findings,
    verticalGaps: verticalBands.gaps.length,
    horizontalGaps: horizontalBands.gaps.length,
    contentBands: verticalBands.contentBands.length
  };
}

module.exports = { analyzeSpacing };
