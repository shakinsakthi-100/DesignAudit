/**
 * Alignment Analyzer Module
 * Detects content block edges and checks if elements align to a consistent grid.
 * Flags misaligned elements with pixel-level deviation measurements.
 */

const { createCanvas, loadImage } = require('./canvas');

/**
 * Detect left edges of content blocks by scanning rows
 * A left edge is where the pixel value first drops below the background threshold
 */
function detectEdges(imageData, width, height) {
  const edges = {
    left: [],   // Left-most content pixel per content row
    right: [],  // Right-most content pixel per content row
  };

  // First, estimate the background color from corners
  const corners = [
    0, // top-left
    (width - 1) * 4, // top-right
    ((height - 1) * width) * 4, // bottom-left
    ((height - 1) * width + width - 1) * 4 // bottom-right
  ];

  let bgR = 0, bgG = 0, bgB = 0;
  for (const idx of corners) {
    bgR += imageData[idx];
    bgG += imageData[idx + 1];
    bgB += imageData[idx + 2];
  }
  bgR = Math.round(bgR / 4);
  bgG = Math.round(bgG / 4);
  bgB = Math.round(bgB / 4);

  const bgThreshold = 30; // Color distance from background to count as content

  // Scan every Nth row for performance
  const rowStep = Math.max(1, Math.floor(height / 200));

  for (let y = 0; y < height; y += rowStep) {
    let leftEdge = -1;
    let rightEdge = -1;

    // Find leftmost content pixel
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dist = Math.abs(imageData[i] - bgR) + Math.abs(imageData[i + 1] - bgG) + Math.abs(imageData[i + 2] - bgB);
      if (dist > bgThreshold) {
        leftEdge = x;
        break;
      }
    }

    // Find rightmost content pixel
    for (let x = width - 1; x >= 0; x--) {
      const i = (y * width + x) * 4;
      const dist = Math.abs(imageData[i] - bgR) + Math.abs(imageData[i + 1] - bgG) + Math.abs(imageData[i + 2] - bgB);
      if (dist > bgThreshold) {
        rightEdge = x;
        break;
      }
    }

    if (leftEdge >= 0) {
      edges.left.push({ y, x: leftEdge });
    }
    if (rightEdge >= 0) {
      edges.right.push({ y, x: rightEdge });
    }
  }

  return edges;
}

/**
 * Cluster edge positions — group edges that are close to the same x-coordinate
 */
function clusterEdges(edgeList, tolerance = 5) {
  if (edgeList.length === 0) return [];

  // Sort by x position
  const sorted = [...edgeList].sort((a, b) => a.x - b.x);
  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].x - sorted[i - 1].x <= tolerance) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length >= 3) { // Minimum cluster size
        clusters.push(currentCluster);
      }
      currentCluster = [sorted[i]];
    }
  }
  if (currentCluster.length >= 3) {
    clusters.push(currentCluster);
  }

  return clusters.map(c => ({
    avgX: Math.round(c.reduce((s, e) => s + e.x, 0) / c.length),
    count: c.length,
    yRange: { start: Math.min(...c.map(e => e.y)), end: Math.max(...c.map(e => e.y)) },
    spread: Math.max(...c.map(e => e.x)) - Math.min(...c.map(e => e.x))
  }));
}

/**
 * Main alignment analysis
 */
async function analyzeAlignment(imagePath) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
  const edges = detectEdges(imageData, img.width, img.height);
  const findings = [];

  // Cluster left edges
  const leftClusters = clusterEdges(edges.left, 4);
  const rightClusters = clusterEdges(edges.right, 4);

  // Check left-edge alignment
  if (leftClusters.length >= 2) {
    // Find elements that don't align with the dominant left edge
    const dominant = leftClusters.reduce((a, b) => a.count > b.count ? a : b);

    for (const cluster of leftClusters) {
      if (cluster === dominant) continue;
      const offset = Math.abs(cluster.avgX - dominant.avgX);

      // Only flag if offset is noticeable but small enough to be a mistake (not intentional indentation)
      if (offset > 3 && offset < 40) {
        const yZone = cluster.yRange.start < img.height * 0.33 ? 'Top' : cluster.yRange.start < img.height * 0.66 ? 'Middle' : 'Bottom';

        findings.push({
          principle: 'Alignment',
          severity: offset > 15 ? 'high' : 'medium',
          location: `${yZone} section, y:${cluster.yRange.start}-${cluster.yRange.end}px`,
          bounds: { x: Math.min(cluster.avgX, dominant.avgX), y: cluster.yRange.start, width: Math.max(10, Math.abs(cluster.avgX - dominant.avgX)), height: Math.max(10, cluster.yRange.end - cluster.yRange.start) },
          description: `Content left edge at x:${cluster.avgX}px is ${offset}px off from the dominant left margin at x:${dominant.avgX}px`,
          userImpact: 'Misaligned elements break the visual flow and create an unprofessional appearance, reducing user confidence in the product',
          recommendation: `Align the left edge of content in this region to x:${dominant.avgX}px to match the dominant content margin. If intentional indentation, use a consistent indent value (e.g., 16px or 24px).`,
          confidence: Math.min(85, Math.round(55 + Math.min(30, offset * 2))),
          evidence: {
            elementEdge: `x:${cluster.avgX}px`,
            dominantMargin: `x:${dominant.avgX}px`,
            offset: `${offset}px`,
            affectedRows: cluster.count
          }
        });
      }
    }
  }

  // Check right-edge alignment (indicates inconsistent widths)
  if (rightClusters.length >= 2) {
    const dominant = rightClusters.reduce((a, b) => a.count > b.count ? a : b);

    for (const cluster of rightClusters) {
      if (cluster === dominant) continue;
      const offset = Math.abs(cluster.avgX - dominant.avgX);

      if (offset > 5 && offset < 50) {
        const yZone = cluster.yRange.start < img.height * 0.33 ? 'Top' : cluster.yRange.start < img.height * 0.66 ? 'Middle' : 'Bottom';

        findings.push({
          principle: 'Alignment',
          severity: 'low',
          location: `${yZone} section, y:${cluster.yRange.start}-${cluster.yRange.end}px, right edge`,
          bounds: { x: Math.min(cluster.avgX, dominant.avgX), y: cluster.yRange.start, width: Math.max(10, Math.abs(cluster.avgX - dominant.avgX)), height: Math.max(10, cluster.yRange.end - cluster.yRange.start) },
          description: `Content right edge at x:${cluster.avgX}px is ${offset}px off from the dominant right margin at x:${dominant.avgX}px`,
          userImpact: 'Inconsistent right margins create a ragged appearance, especially noticeable in card layouts or text blocks',
          recommendation: `Consider adjusting content width so the right edge aligns at x:${dominant.avgX}px, or ensure container widths are consistent.`,
          confidence: Math.min(70, Math.round(40 + Math.min(30, offset * 1.5))),
          evidence: {
            elementEdge: `x:${cluster.avgX}px`,
            dominantMargin: `x:${dominant.avgX}px`,
            offset: `${offset}px`
          }
        });
      }
    }
  }

  // Check content centering
  if (leftClusters.length > 0 && rightClusters.length > 0) {
    const mainLeft = leftClusters.reduce((a, b) => a.count > b.count ? a : b);
    const mainRight = rightClusters.reduce((a, b) => a.count > b.count ? a : b);
    const leftMargin = mainLeft.avgX;
    const rightMargin = img.width - mainRight.avgX;
    const marginDiff = Math.abs(leftMargin - rightMargin);

    if (marginDiff > 20 && leftMargin > 10 && rightMargin > 10) {
      findings.push({
        principle: 'Alignment',
        severity: marginDiff > 40 ? 'medium' : 'low',
        location: 'Full page layout',
        bounds: { x: 0, y: 0, width: img.width, height: img.height },
        description: `Main content area has asymmetric margins: left margin ${leftMargin}px vs right margin ${rightMargin}px (${marginDiff}px difference)`,
        userImpact: 'Asymmetric margins make the page feel visually unbalanced, especially on wide screens',
        recommendation: `Center the main content by equalizing margins to approximately ${Math.round((leftMargin + rightMargin) / 2)}px on each side, or use a max-width container with auto margins.`,
        confidence: Math.min(80, Math.round(50 + Math.min(30, marginDiff))),
        evidence: {
          leftMargin: `${leftMargin}px`,
          rightMargin: `${rightMargin}px`,
          difference: `${marginDiff}px`,
          suggestedMargin: `${Math.round((leftMargin + rightMargin) / 2)}px`
        }
      });
    }
  }

  return {
    findings,
    leftEdgeClusters: leftClusters.length,
    rightEdgeClusters: rightClusters.length
  };
}

module.exports = { analyzeAlignment };
