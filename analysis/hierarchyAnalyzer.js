/**
 * Hierarchy Analyzer Module
 * Analyzes visual weight distribution across the page to determine if there's
 * a clear information hierarchy. Checks for competing elements and unclear CTAs.
 */

const { getColorGrid, colorDistance } = require('./colorExtractor');

/**
 * Calculate visual weight of a color (combination of saturation, brightness contrast from background)
 */
function visualWeight(color, bgColor) {
  // Saturation component (colorful elements draw more attention)
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  // Brightness contrast from background
  const bgBrightness = (bgColor.r + bgColor.g + bgColor.b) / 3;
  const fgBrightness = (color.r + color.g + color.b) / 3;
  const brightnessContrast = Math.abs(bgBrightness - fgBrightness) / 255;

  // Color distance from background (unique colors stand out)
  const dist = colorDistance(color, bgColor) / 441; // Max possible distance = sqrt(255^2*3)

  // Combined weight (weighted formula)
  return saturation * 0.3 + brightnessContrast * 0.4 + dist * 0.3;
}

/**
 * Identify the dominant region (likely primary CTA or focal point)
 */
function findDominantRegions(grid, bgColor) {
  const weightedCells = [];

  for (let gy = 0; gy < grid.length; gy++) {
    for (let gx = 0; gx < grid[gy].length; gx++) {
      const cell = grid[gy][gx];
      if (!cell.isContent) continue;

      const weight = visualWeight(cell.color, bgColor);
      weightedCells.push({
        gy, gx,
        x: cell.x, y: cell.y,
        w: cell.w, h: cell.h,
        hex: cell.hex,
        weight,
        color: cell.color,
        variance: cell.variance
      });
    }
  }

  // Sort by visual weight
  weightedCells.sort((a, b) => b.weight - a.weight);
  return weightedCells;
}

/**
 * Main hierarchy analysis
 */
async function analyzeHierarchy(imagePath) {
  const { grid, dimensions, cellWidth, cellHeight } = await getColorGrid(imagePath, 10);
  const gridSize = grid.length;
  const findings = [];

  // Estimate background color (most common color in border cells)
  const borderCells = [];
  for (let gx = 0; gx < grid[0].length; gx++) {
    borderCells.push(grid[0][gx]); // Top row
    borderCells.push(grid[gridSize - 1][gx]); // Bottom row
  }
  for (let gy = 1; gy < gridSize - 1; gy++) {
    borderCells.push(grid[gy][0]); // Left column
    borderCells.push(grid[gy][grid[gy].length - 1]); // Right column
  }

  const bgColor = borderCells.reduce((acc, c) => {
    acc.r += c.color.r;
    acc.g += c.color.g;
    acc.b += c.color.b;
    return acc;
  }, { r: 0, g: 0, b: 0 });
  bgColor.r = Math.round(bgColor.r / borderCells.length);
  bgColor.g = Math.round(bgColor.g / borderCells.length);
  bgColor.b = Math.round(bgColor.b / borderCells.length);

  // Get weighted regions
  const regions = findDominantRegions(grid, bgColor);

  if (regions.length === 0) {
    findings.push({
      principle: 'Visual Hierarchy',
      severity: 'info',
      location: 'Full page',
      description: 'The page appears to have minimal visual content, making hierarchy analysis difficult',
      userImpact: 'N/A',
      recommendation: 'Ensure the page has sufficient content to establish a visual hierarchy',
      confidence: 40,
      evidence: {}
    });
    return { findings };
  }

  // Check 1: Is there a clear primary element?
  const topWeight = regions[0].weight;
  const secondWeight = regions.length > 1 ? regions[1].weight : 0;
  const weightDiff = topWeight - secondWeight;

  if (weightDiff < 0.08 && regions.length >= 2) {
    const loc1 = getZone(regions[0].gy, regions[0].gx, gridSize);
    const loc2 = getZone(regions[1].gy, regions[1].gx, gridSize);

    findings.push({
      principle: 'Visual Hierarchy',
      severity: 'high',
      location: `${loc1} and ${loc2} regions`,
      bounds: { x: regions[0].x, y: regions[0].y, width: regions[0].w, height: regions[0].h },
      description: `Two elements compete for visual attention with nearly equal weight: ${regions[0].hex} (weight: ${(topWeight * 100).toFixed(0)}%) and ${regions[1].hex} (weight: ${(secondWeight * 100).toFixed(0)}%)`,
      userImpact: 'When multiple elements have equal visual prominence, users cannot quickly identify the primary action or most important content, increasing decision time and reducing conversion',
      recommendation: `Strengthen the primary element by increasing its size, color saturation, or contrast. Alternatively, de-emphasize the secondary element — consider a lighter color, smaller size, or outlined style instead of filled.`,
      confidence: Math.min(80, Math.round(55 + (1 - weightDiff) * 30)),
      evidence: {
        primaryElement: { hex: regions[0].hex, weight: `${(topWeight * 100).toFixed(0)}%`, location: loc1 },
        competingElement: { hex: regions[1].hex, weight: `${(secondWeight * 100).toFixed(0)}%`, location: loc2 },
        weightDifference: `${(weightDiff * 100).toFixed(1)}%`
      }
    });
  }

  // Check 2: Are there too many high-weight elements? (information overload)
  const highWeightThreshold = topWeight * 0.7;
  const highWeightRegions = regions.filter(r => r.weight >= highWeightThreshold);

  if (highWeightRegions.length > 4) {
    findings.push({
      principle: 'Visual Hierarchy',
      severity: 'medium',
      location: 'Multiple areas across the page',
      bounds: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
      description: `${highWeightRegions.length} distinct regions compete for attention at similar visual weights, creating information overload`,
      userImpact: 'Too many visually prominent elements overwhelm users, leading to decision fatigue and lower engagement rates',
      recommendation: 'Establish a clear 3-level hierarchy: one primary element (high weight), 2-3 secondary elements (medium weight), and remaining content at a lower visual weight. Use size, color intensity, and whitespace to differentiate levels.',
      confidence: Math.min(75, Math.round(45 + highWeightRegions.length * 5)),
      evidence: {
        competingRegions: highWeightRegions.length,
        threshold: `${(highWeightThreshold * 100).toFixed(0)}% of max weight`,
        regions: highWeightRegions.slice(0, 5).map(r => ({
          hex: r.hex,
          location: getZone(r.gy, r.gx, gridSize),
          weight: `${(r.weight * 100).toFixed(0)}%`
        }))
      }
    });
  }

  // Check 3: Is the primary element in a scannable position?
  // F-pattern: primary content should be top-left or top-center
  if (regions.length > 0) {
    const primary = regions[0];
    const isTopHalf = primary.gy < gridSize * 0.5;
    const isLeftOrCenter = primary.gx < gridSize * 0.7;

    if (!isTopHalf) {
      findings.push({
        principle: 'Visual Hierarchy',
        severity: 'medium',
        location: getZone(primary.gy, primary.gx, gridSize),
        bounds: { x: primary.x, y: primary.y, width: primary.w, height: primary.h },
        description: `The most visually prominent element (${primary.hex}) is positioned in the bottom half of the page at y:${primary.y}px, which is below the initial viewport fold for most users`,
        userImpact: 'Primary content below the fold requires scrolling to discover, reducing engagement and increasing bounce rates',
        recommendation: 'Move the primary call-to-action or focal element to the top half of the page, ideally within the first 600px of vertical space. Follow the F-pattern or Z-pattern reading model.',
        confidence: Math.min(70, Math.round(50 + (primary.gy / gridSize) * 25)),
        evidence: {
          primaryPosition: `y:${primary.y}px (${Math.round(primary.gy / gridSize * 100)}% down the page)`,
          idealPosition: 'Top 40% of page (above fold)',
          element: primary.hex
        }
      });
    }
  }

  // Check 4: Visual monotony — all content areas have similar weight
  if (regions.length >= 4) {
    const weights = regions.slice(0, 6).map(r => r.weight);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const maxDev = Math.max(...weights.map(w => Math.abs(w - avgWeight)));

    if (maxDev < 0.06) {
      findings.push({
        principle: 'Visual Hierarchy',
        severity: 'medium',
        location: 'Full page',
        bounds: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
        description: 'Content areas have very similar visual weight (weight range: ${(Math.min(...weights) * 100).toFixed(0)}%-${(Math.max(...weights) * 100).toFixed(0)}%), creating a flat, monotonous layout',
        userImpact: 'A flat hierarchy provides no visual guidance, forcing users to scan every element sequentially rather than being guided to key content',
        recommendation: 'Introduce visual hierarchy through varied font sizes (e.g., 32px heading, 18px subheading, 14px body), different color saturations, and strategic whitespace to separate primary from secondary content.',
        confidence: Math.min(70, Math.round(50 + (1 - maxDev) * 25)),
        evidence: {
          weightRange: `${(Math.min(...weights) * 100).toFixed(0)}% - ${(Math.max(...weights) * 100).toFixed(0)}%`,
          maxDeviation: `${(maxDev * 100).toFixed(1)}%`,
          idealMinDeviation: '15-20%'
        }
      });
    }
  }

  return { findings };
}

/**
 * Get human-readable zone name from grid coordinates
 */
function getZone(gy, gx, gridSize) {
  const yZone = gy < gridSize * 0.25 ? 'Top' : gy < gridSize * 0.75 ? 'Middle' : 'Bottom';
  const xZone = gx < gridSize * 0.33 ? 'left' : gx < gridSize * 0.66 ? 'center' : 'right';
  return `${yZone}-${xZone}`;
}

module.exports = { analyzeHierarchy };
