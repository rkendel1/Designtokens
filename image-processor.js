const axios = require('axios');
const sharp = require('sharp');
const ColorThief = require('colorthief');

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
 * Extracts a color palette from an image buffer using the ColorThief library.
 * @param {Buffer} imageBuffer - The image buffer from the screenshot.
 * @param {number} k - The number of colors to extract.
 * @returns {Promise<Array<string>>} An array of RGB color strings representing the palette.
 */
async function extractColorPalette(imageBuffer, k = 8) {
  try {
    // getPalette returns an array of [R, G, B] arrays.
    const paletteRGB = await ColorThief.getPalette(imageBuffer, k);
    
    if (!paletteRGB) {
      return [];
    }

    // Convert the palette to the expected 'rgb(r, g, b)' string format.
    const palette = paletteRGB.map(rgb => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
    
    return palette;
  } catch (error) {
    console.error('Failed to extract color palette with ColorThief:', error.message);
    return [];
  }
}

module.exports = { resizeLogo, extractColorPalette };