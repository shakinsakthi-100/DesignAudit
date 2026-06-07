/**
 * Custom canvas shim using jimp to avoid native node-canvas C++ compilation issues on Windows.
 */
const Jimp = require('jimp');

class CanvasContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.image = null;
  }

  drawImage(img, dx, dy) {
    // img is the object returned by loadImage
    this.image = img._jimpImage;
  }

  getImageData(sx, sy, sw, sh) {
    if (!this.image) {
      throw new Error('No image has been drawn on this context');
    }

    const fullWidth = this.image.bitmap.width;
    const fullHeight = this.image.bitmap.height;
    const fullData = this.image.bitmap.data; // Node.js Buffer

    // Optimization: if requesting the entire image, return the full buffer directly
    if (sx === 0 && sy === 0 && sw === fullWidth && sh === fullHeight) {
      return { data: Uint8ClampedArray.from(fullData) };
    }

    // Otherwise, copy the sub-rectangle
    const subData = Buffer.alloc(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      const srcY = sy + y;
      if (srcY >= fullHeight) break;
      const srcOffset = (srcY * fullWidth + sx) * 4;
      const destOffset = y * sw * 4;
      const length = Math.min(sw * 4, (fullWidth - sx) * 4);

      if (length > 0 && srcOffset < fullData.length) {
        fullData.copy(subData, destOffset, srcOffset, srcOffset + length);
      }
    }

    return { data: Uint8ClampedArray.from(subData) };
  }
}

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.context = new CanvasContext(this);
  }

  getContext(type) {
    if (type !== '2d') {
      throw new Error('Only 2d context is supported by this shim');
    }
    return this.context;
  }
}

function createCanvas(width, height) {
  return new Canvas(width, height);
}

async function loadImage(imagePath) {
  try {
    const image = await Jimp.read(imagePath);
    return {
      width: image.bitmap.width,
      height: image.bitmap.height,
      _jimpImage: image
    };
  } catch (error) {
    throw new Error(`Failed to load image at ${imagePath}: ${error.message}`);
  }
}

module.exports = {
  createCanvas,
  loadImage
};
