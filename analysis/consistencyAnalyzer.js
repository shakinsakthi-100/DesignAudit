/**
 * Consistency Analyzer Module
 * Evaluates design consistency: color palette harmony, spacing rhythm,
 * and pattern regularity across the page.
 */

const { extractColors } = require('./colorExtractor');

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Check if colors form a harmonious palette
 * Harmonious palettes: monochromatic, analogous, complementary, triadic
 */
function checkColorHarmony(palette) {
  const hues = palette
    .map(c => rgbToHsl(c.rgb.r, c.rgb.g, c.rgb.b))
    .filter(h => h.s > 10) // Only consider saturated colors
    .map(h => h.h);

  if (hues.length < 2) return { harmonious: true, type: 'monochromatic' };

  // Count distinct hue groups (30° buckets)
  const hueBuckets = new Set(hues.map(h => Math.round(h / 30) * 30));
  const distinctHues = hueBuckets.size;

  // Check for common color schemes
  if (distinctHues <= 1) return { harmonious: true, type: 'monochromatic', distinctHues };
  if (distinctHues <= 3) {
    // Check if analogous (within 60° of each other)
    const hueArray = [...hueBuckets];
    const isAnalogous = hueArray.every(h =>
      hueArray.some(h2 => {
        const diff = Math.abs(h - h2);
        return diff <= 60 || diff >= 300;
      })
    );
    if (isAnalogous) return { harmonious: true, type: 'analogous', distinctHues };
    return { harmonious: true, type: 'triadic', distinctHues };
  }
  if (distinctHues <= 4) return { harmonious: true, type: 'tetradic', distinctHues };

  return { harmonious: false, type: 'unstructured', distinctHues };
}

/**
 * Check saturation consistency across the palette
 */
function checkSaturationConsistency(palette) {
  const saturations = palette
    .map(c => rgbToHsl(c.rgb.r, c.rgb.g, c.rgb.b))
    .filter(h => h.s > 5) // Ignore near-grayscale
    .map(h => h.s);

  if (saturations.length < 2) return { consistent: true };

  const avgSat = saturations.reduce((a, b) => a + b, 0) / saturations.length;
  const maxDev = Math.max(...saturations.map(s => Math.abs(s - avgSat)));

  return {
    consistent: maxDev <= 35,
    avgSaturation: Math.round(avgSat),
    maxDeviation: Math.round(maxDev),
    saturations
  };
}

/**
 * Main consistency analysis
 */
async function analyzeConsistency(imagePath) {
  const colorData = await extractColors(imagePath);
  const findings = [];

  // Check 1: Color palette harmony
  const harmony = checkColorHarmony(colorData.palette);
  if (!harmony.harmonious) {
    findings.push({
      principle: 'Consistency',
      severity: 'medium',
      location: 'Full page color palette',
      bounds: { x: 0, y: 0, width: colorData.dimensions.width, height: colorData.dimensions.height },
      description: `The color palette uses ${harmony.distinctHues} distinct hue families, which does not follow a recognized color harmony scheme (monochromatic, analogous, complementary, or triadic)`,
      userImpact: 'An unstructured color palette creates visual noise and makes the brand feel inconsistent, reducing user trust and recognition',
      recommendation: `Reduce to 2-3 primary hue families. Select colors using a color harmony tool — choose analogous (adjacent on color wheel) or complementary (opposite) schemes. Current palette: ${colorData.palette.slice(0, 5).map(c => c.hex).join(', ')}`,
      confidence: Math.min(80, Math.round(50 + harmony.distinctHues * 5)),
      evidence: {
        distinctHues: harmony.distinctHues,
        colorSchemeType: harmony.type,
        currentPalette: colorData.palette.slice(0, 6).map(c => c.hex),
        recommendation: 'Use 2-3 hue families max with tints and shades for variation'
      }
    });
  }

  // Check 2: Too many distinct colors in the palette
  if (colorData.totalDistinctColors > 20) {
    const severity = colorData.totalDistinctColors > 40 ? 'high' : 'medium';
    findings.push({
      principle: 'Consistency',
      severity,
      location: 'Full page',
      bounds: { x: 0, y: 0, width: colorData.dimensions.width, height: colorData.dimensions.height },
      description: `${colorData.totalDistinctColors} distinct color values detected (after quantization). A well-designed page typically uses 5-10 intentional colors`,
      userImpact: 'Excessive color variety indicates inconsistent styling — elements that should look unified appear different, confusing users about interactive vs static content',
      recommendation: `Consolidate to a design system palette: 1-2 brand colors, 1 accent color, 2-3 neutral grays, and semantic colors (success, warning, error). Current dominant colors: ${colorData.palette.slice(0, 4).map(c => c.hex).join(', ')}`,
      confidence: Math.min(75, Math.round(40 + Math.min(35, colorData.totalDistinctColors))),
      evidence: {
        distinctColors: colorData.totalDistinctColors,
        idealRange: '5-10 intentional colors',
        topColors: colorData.palette.slice(0, 8).map(c => ({ hex: c.hex, frequency: `${c.frequency}%` }))
      }
    });
  }

  // Check 3: Saturation consistency
  const satConsistency = checkSaturationConsistency(colorData.palette);
  if (!satConsistency.consistent && satConsistency.saturations && satConsistency.saturations.length >= 3) {
    findings.push({
      principle: 'Consistency',
      severity: 'low',
      location: 'Accent and interactive colors',
      bounds: { x: 0, y: 0, width: colorData.dimensions.width, height: colorData.dimensions.height },
      description: `Color saturations vary widely across the palette (range: ${Math.min(...satConsistency.saturations)}% to ${Math.max(...satConsistency.saturations)}%, average: ${satConsistency.avgSaturation}%). This creates visual inconsistency between UI elements.`,
      userImpact: 'Mixed saturation levels make some elements appear more vibrant than others unintentionally, breaking visual consistency and potentially misleading users about element importance',
      recommendation: `Normalize saturations to a consistent range. For vibrant UIs, target 60-80% saturation; for muted UIs, target 30-50%. Avoid mixing highly saturated and desaturated colors for similar-purpose elements.`,
      confidence: Math.min(65, Math.round(35 + Math.min(30, satConsistency.maxDeviation))),
      evidence: {
        saturations: satConsistency.saturations.map(s => `${s}%`),
        avgSaturation: `${satConsistency.avgSaturation}%`,
        maxDeviation: `${satConsistency.maxDeviation}%`
      }
    });
  }

  // Check 4: Background/foreground color ratio
  if (colorData.palette.length >= 2) {
    const bgFrequency = colorData.palette[0].frequency;
    const contentFrequency = colorData.palette.slice(1).reduce((s, c) => s + c.frequency, 0);

    // Ideal: ~60-75% background, 25-40% content
    if (bgFrequency > 85) {
      findings.push({
        principle: 'Consistency',
        severity: 'info',
        location: 'Full page layout',
        bounds: { x: 0, y: 0, width: colorData.dimensions.width, height: colorData.dimensions.height },
        description: `Background color (${colorData.palette[0].hex}) occupies ${bgFrequency.toFixed(0)}% of the page, leaving very little visual content area`,
        userImpact: 'Excessive whitespace can make a page feel empty and underutilized, though strategic whitespace improves readability',
        recommendation: 'Consider whether the large background area is intentional. If the page is content-sparse, add relevant content or reduce the container size.',
        confidence: 50,
        evidence: {
          backgroundColor: colorData.palette[0].hex,
          backgroundCoverage: `${bgFrequency.toFixed(0)}%`,
          contentCoverage: `${contentFrequency.toFixed(0)}%`
        }
      });
    } else if (bgFrequency < 40) {
      findings.push({
        principle: 'Consistency',
        severity: 'medium',
        location: 'Full page layout',
        bounds: { x: 0, y: 0, width: colorData.dimensions.width, height: colorData.dimensions.height },
        description: `No dominant background color found — the most frequent color covers only ${bgFrequency.toFixed(0)}% of the page, suggesting dense or cluttered content`,
        userImpact: 'Without breathing room between content blocks, users experience cognitive overload and have difficulty focusing on any single element',
        recommendation: 'Introduce more whitespace between content sections. Increase padding and margins to create visual breathing room (16-32px minimum between major sections).',
        confidence: 60,
        evidence: {
          dominantColor: colorData.palette[0].hex,
          coverage: `${bgFrequency.toFixed(0)}%`,
          idealRange: '55-75% background coverage'
        }
      });
    }
  }

  return {
    findings,
    colorHarmony: harmony,
    paletteSize: colorData.totalDistinctColors
  };
}

module.exports = { analyzeConsistency };
