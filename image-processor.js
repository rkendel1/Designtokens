const axios = require('axios');
const sharp = require('sharp');
const { kmeans } = require('ml-kmeans');

/**
 * Downloads an image from a URL and resizes it to standard icon sizes.
 * @param {string} imageUrl - The URL of the logo to process.
 * @returns {Promise<object|null>} An object with base64-encoded strings for small, medium, and large logos, or null on failure.
 */
async function resizeLogo(imageUrl) {
  if (!imageUrl) return null;

  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const sizes = {
      small: 32,
      medium: 64,
      large: 256
    };

    const resized = {};

    // Generate base64 strings for each size
    resized.small = (await sharp(buffer).resize(sizes.small).png().toBuffer()).toString('base64');
    resized.medium = (await sharp(buffer).resize(sizes.medium).png().toBuffer()).toString('base64');
    resized.large = (await sharp(buffer).resize(sizes.large).png().toBuffer()).toString('base64');

    return resized;
  } catch (error) {
    console.error(`Failed to resize logo from ${imageUrl}:`, error.message);
    return null;
  }
}

/**
 * Extracts a color palette from an image buffer using k-means clustering.
 * @param {Buffer} imageBuffer - The image buffer from the screenshot.
 * @param {number} k - The number of clusters (colors) to find.
 * @returns {Promise<Array<string>>} An array of RGB color strings representing the palette.
 */
async function extractColorPalette(imageBuffer, k = 8) {
  try {
    const { data } = await sharp(imageBuffer)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // Downsample for performance on large images
    const sampleSize = 10000;
    const step = Math.max(1, Math.floor(pixels.length / sampleSize));
    const sampledPixels = pixels.filter((_, i) => i % step === 0);

    if (sampledPixels.length < k) {
      console.warn(`Not enough unique pixels to perform clustering with k=${k}.`);
      const uniqueColors = Array.from(new Set(sampledPixels.map(p => `rgb(${p[0]}, ${p[1]}, ${p[2]})`)));
      return uniqueColors.slice(0, k);
    }

    const result = kmeans(sampledPixels, k, { initialization: 'kmeans++' });
    const centroids = result.centroids.map(c => c.centroid);

    const palette = centroids.map(centroid => {
      const [r, g, b] = centroid.map(Math.round);
      return `rgb(${r}, ${g}, ${b})`;
    });

    return palette;
  } catch (error) {
    console.error('Failed to extract color palette with k-means:', error.message);
    return [];
  }
}

module.exports = { resizeLogo, extractColorPalette };