/**
 * Contrast Analyzer Module
 * Implements WCAG 2.1 contrast ratio calculations and checks adjacent regions
 * for AA compliance (4.5:1 for normal text, 3:1 for large text/UI components).
 */

const { getColorGrid } = require('./colorExtractor');

/**
 * Convert sRGB component to linear RGB (gamma correction)
 */
function sRGBtoLinear(value) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r, g, b) {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio in format X.XX:1
 */
function contrastRatio(color1, color2) {
  const l1 = relativeLuminance(color1.r, color1.g, color1.b);
  const l2 = relativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get a human-readable location string from grid coordinates
 */
function getLocationFromGrid(gy, gx, cellWidth, cellHeight, gridSize) {
  const yStart = gy * cellHeight;
  const yEnd = (gy + 1) * cellHeight;
  const xStart = gx * cellWidth;
  const xEnd = (gx + 1) * cellWidth;

  const yZone = gy < gridSize * 0.25 ? 'Top' : gy < gridSize * 0.75 ? 'Middle' : 'Bottom';
  const xZone = gx < gridSize * 0.33 ? 'left' : gx < gridSize * 0.66 ? 'center' : 'right';

  return {
    description: `${yZone}-${xZone} region`,
    bounds: `x:${xStart}-${xEnd}px, y:${yStart}-${yEnd}px`
  };
}

/**
 * Find the minimum passing color for a given background
 * Suggests the darkest/lightest adjustment needed to meet WCAG AA
 */
function suggestFix(foreground, background, targetRatio = 4.5) {
  const bgLum = relativeLuminance(background.r, background.g, background.b);
  const fgLum = relativeLuminance(foreground.r, foreground.g, foreground.b);

  // Determine if we should darken or lighten the foreground
  if (fgLum > bgLum) {
    // Foreground is lighter — need to make it even lighter or darken bg
    const neededLum = (bgLum + 0.05) * targetRatio - 0.05;
    if (neededLum <= 1) {
      // Lighten foreground
      const factor = Math.min(2, neededLum / Math.max(0.001, fgLum));
      return {
        hex: adjustBrightness(foreground, factor),
        action: 'lighten foreground'
      };
    }
  }

  // Darken foreground
  const neededLum = (bgLum + 0.05) / targetRatio - 0.05;
  const factor = neededLum / Math.max(0.001, fgLum);
  return {
    hex: adjustBrightness(foreground, Math.max(0.1, factor)),
    action: 'darken foreground'
  };
}

/**
 * Adjust brightness of a color by a factor
 */
function adjustBrightness(color, factor) {
  const r = Math.min(255, Math.max(0, Math.round(color.r * factor)));
  const g = Math.min(255, Math.max(0, Math.round(color.g * factor)));
  const b = Math.min(255, Math.max(0, Math.round(color.b * factor)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Analyze contrast across the image by checking adjacent grid cells
 */
async function analyzeContrast(imagePath) {
  const { grid, dimensions, cellWidth, cellHeight } = await getColorGrid(imagePath, 12);
  const gridSize = grid.length;
  const findings = [];
  const checked = new Set();

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < grid[gy].length; gx++) {
      const cell = grid[gy][gx];

      // Check adjacent cells (right, below, diagonal)
      const neighbors = [
        { dy: 0, dx: 1 },  // right
        { dy: 1, dx: 0 },  // below
      ];

      for (const { dy, dx } of neighbors) {
        const ny = gy + dy;
        const nx = gx + dx;
        if (ny >= gridSize || nx >= grid[0].length) continue;

        const neighbor = grid[ny][nx];
        const pairKey = `${gy},${gx}-${ny},${nx}`;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        // Only check pairs where at least one cell has content (high variance)
        if (!cell.isContent && !neighbor.isContent) continue;

        const ratio = contrastRatio(cell.color, neighbor.color);

        // Only flag if there's meaningful color difference (not same region)
        const colorDiff = Math.abs(
          relativeLuminance(cell.color.r, cell.color.g, cell.color.b) -
          relativeLuminance(neighbor.color.r, neighbor.color.g, neighbor.color.b)
        );
        if (colorDiff < 0.01) continue; // Skip nearly identical adjacent cells

        // Check WCAG AA thresholds
        if (ratio < 3.0) {
          const location = getLocationFromGrid(gy, gx, cellWidth, cellHeight, gridSize);
          const fix = suggestFix(cell.color, neighbor.color);

          findings.push({
            principle: 'Contrast (WCAG AA)',
            severity: ratio < 2.0 ? 'critical' : 'high',
            location: location.description,
            locationBounds: location.bounds,
            bounds: { x: gx * cellWidth, y: gy * cellHeight, width: cellWidth, height: cellHeight },
            description: `Color ${cell.hex} against ${neighbor.hex} has a contrast ratio of ${ratio.toFixed(2)}:1, which fails WCAG AA requirements`,
            userImpact: ratio < 2.0
              ? 'Text or UI elements in this region are extremely difficult to read for all users, and impossible for users with low vision'
              : 'Users with moderate visual impairments will struggle to distinguish content in this area',
            recommendation: `Adjust the foreground color — ${fix.action} to at least ${fix.hex} to achieve the minimum 4.5:1 ratio for normal text or 3:1 for large text/UI components`,
            confidence: Math.min(95, Math.round(70 + (cell.isContent ? 15 : 0) + (neighbor.isContent ? 10 : 0))),
            evidence: {
              foreground: cell.hex,
              background: neighbor.hex,
              contrastRatio: `${ratio.toFixed(2)}:1`,
              requiredRatio: '4.5:1 (normal text) / 3:1 (large text)',
              wcagLevel: 'AA',
              suggestedFix: fix.hex
            }
          });
        } else if (ratio < 4.5 && (cell.isContent || neighbor.isContent)) {
          const location = getLocationFromGrid(gy, gx, cellWidth, cellHeight, gridSize);
          const fix = suggestFix(cell.color, neighbor.color);

          findings.push({
            principle: 'Contrast (WCAG AA)',
            severity: 'medium',
            location: location.description,
            locationBounds: location.bounds,
            bounds: { x: gx * cellWidth, y: gy * cellHeight, width: cellWidth, height: cellHeight },
            description: `Color ${cell.hex} against ${neighbor.hex} has a contrast ratio of ${ratio.toFixed(2)}:1 — passes for large text (3:1) but fails for normal text (4.5:1)`,
            userImpact: 'Small text in this region may be difficult to read for users with visual impairments',
            recommendation: `If this region contains normal-sized text, ${fix.action} to at least ${fix.hex}. If large text or UI components only, current contrast is acceptable`,
            confidence: Math.min(85, Math.round(55 + (cell.isContent ? 15 : 0) + (neighbor.isContent ? 15 : 0))),
            evidence: {
              foreground: cell.hex,
              background: neighbor.hex,
              contrastRatio: `${ratio.toFixed(2)}:1`,
              requiredRatio: '4.5:1 (normal text)',
              wcagLevel: 'AA',
              suggestedFix: fix.hex
            }
          });
        }
      }
    }
  }

  // Deduplicate similar findings in the same region
  const deduplicated = deduplicateFindings(findings);

  return {
    findings: deduplicated.slice(0, 8), // Cap at 8 most severe findings
    totalChecked: checked.size,
    passRate: findings.length === 0
      ? 100
      : Math.round((1 - findings.length / checked.size) * 100)
  };
}

/**
 * Remove duplicate findings for the same region
 */
function deduplicateFindings(findings) {
  const seen = new Map();
  for (const f of findings) {
    const key = `${f.location}-${f.severity}`;
    if (!seen.has(key) || f.confidence > seen.get(key).confidence) {
      seen.set(key, f);
    }
  }
  return [...seen.values()].sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (sevOrder[a.severity] || 4) - (sevOrder[b.severity] || 4);
  });
}

module.exports = { analyzeContrast, contrastRatio, relativeLuminance };
