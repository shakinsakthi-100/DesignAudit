/**
 * Color Extractor Module
 * Extracts dominant colors from an image using pixel sampling and quantization.
 * Returns a structured palette with hex values, RGB, frequency, and spatial regions.
 */

const { createCanvas, loadImage } = require('./canvas');

/**
 * Convert RGB values to hex string
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate the region of the image where a color appears most
 */
function getRegion(positions, imgWidth, imgHeight) {
  if (!positions.length) return 'unknown';

  const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length;
  const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length;

  const xZone = avgX < imgWidth * 0.33 ? 'left' : avgX < imgWidth * 0.66 ? 'center' : 'right';
  const yZone = avgY < imgHeight * 0.25 ? 'top' : avgY < imgHeight * 0.75 ? 'middle' : 'bottom';

  return `${yZone}-${xZone}`;
}

/**
 * Calculate color distance (Euclidean in RGB space)
 */
function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Get a grid-based color map of the image
 * Divides image into gridSize x gridSize cells and finds dominant color in each
 */
async function getColorGrid(imagePath, gridSize = 10) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const cellWidth = Math.floor(img.width / gridSize);
  const cellHeight = Math.floor(img.height / gridSize);
  const grid = [];

  for (let gy = 0; gy < gridSize; gy++) {
    const row = [];
    for (let gx = 0; gx < gridSize; gx++) {
      const x = gx * cellWidth;
      const y = gy * cellHeight;
      const w = Math.min(cellWidth, img.width - x);
      const h = Math.min(cellHeight, img.height - y);

      const cellData = ctx.getImageData(x, y, w, h);
      const pixels = cellData.data;

      // Calculate average color and variance for this cell
      let rSum = 0, gSum = 0, bSum = 0;
      let rSqSum = 0, gSqSum = 0, bSqSum = 0;
      const pixelCount = pixels.length / 4;

      for (let i = 0; i < pixels.length; i += 4) {
        rSum += pixels[i];
        gSum += pixels[i + 1];
        bSum += pixels[i + 2];
        rSqSum += pixels[i] * pixels[i];
        gSqSum += pixels[i + 1] * pixels[i + 1];
        bSqSum += pixels[i + 2] * pixels[i + 2];
      }

      const avgR = Math.round(rSum / pixelCount);
      const avgG = Math.round(gSum / pixelCount);
      const avgB = Math.round(bSum / pixelCount);

      // Color variance indicates if cell is uniform (background) or mixed (content)
      const variance = (
        (rSqSum / pixelCount - avgR * avgR) +
        (gSqSum / pixelCount - avgG * avgG) +
        (bSqSum / pixelCount - avgB * avgB)
      ) / 3;

      row.push({
        x, y, w, h,
        color: { r: avgR, g: avgG, b: avgB },
        hex: rgbToHex(avgR, avgG, avgB),
        variance: Math.round(variance),
        isContent: variance > 500 // High variance = likely has content
      });
    }
    grid.push(row);
  }

  return { grid, dimensions: { width: img.width, height: img.height }, cellWidth, cellHeight };
}

/**
 * Extract dominant colors from an image
 */
async function extractColors(imagePath) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const pixels = imageData.data;

  // Adaptive sample rate based on image size
  const totalPixels = img.width * img.height;
  const sampleRate = Math.max(1, Math.floor(Math.sqrt(totalPixels) / 150));

  // Collect and quantize color samples
  const quantized = new Map();
  const step = 24; // Quantization step — groups similar colors

  for (let y = 0; y < img.height; y += sampleRate) {
    for (let x = 0; x < img.width; x += sampleRate) {
      const i = (y * img.width + x) * 4;
      const r = Math.round(pixels[i] / step) * step;
      const g = Math.round(pixels[i + 1] / step) * step;
      const b = Math.round(pixels[i + 2] / step) * step;
      const key = `${r},${g},${b}`;

      if (!quantized.has(key)) {
        quantized.set(key, {
          r: Math.min(255, r), g: Math.min(255, g), b: Math.min(255, b),
          count: 0,
          positions: []
        });
      }
      const entry = quantized.get(key);
      entry.count++;
      // Store a subset of positions to avoid memory issues
      if (entry.positions.length < 50) {
        entry.positions.push({ x, y });
      }
    }
  }

  // Sort by frequency
  const sorted = [...quantized.values()].sort((a, b) => b.count - a.count);
  const totalSamples = sorted.reduce((s, c) => s + c.count, 0);

  // Merge similar colors that are close in RGB space
  const merged = [];
  const mergeThreshold = 40;

  for (const color of sorted) {
    let wasMerged = false;
    for (const existing of merged) {
      if (colorDistance(color, existing) < mergeThreshold) {
        existing.count += color.count;
        existing.positions.push(...color.positions.slice(0, 10));
        wasMerged = true;
        break;
      }
    }
    if (!wasMerged) {
      merged.push({ ...color });
    }
  }

  merged.sort((a, b) => b.count - a.count);

  const palette = merged.slice(0, 12).map(c => ({
    hex: rgbToHex(c.r, c.g, c.b),
    rgb: { r: c.r, g: c.g, b: c.b },
    frequency: parseFloat((c.count / totalSamples * 100).toFixed(1)),
    region: getRegion(c.positions, img.width, img.height)
  }));

  return {
    palette,
    dimensions: { width: img.width, height: img.height },
    totalDistinctColors: quantized.size,
    dominantColor: palette[0] || null,
    backgroundColor: palette[0] || null, // Most frequent is likely background
    accentColors: palette.slice(1, 5)
  };
}

module.exports = { extractColors, getColorGrid, rgbToHex, colorDistance };
