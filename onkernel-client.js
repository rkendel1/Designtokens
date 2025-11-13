const { OnKernel } = require('onkernel');
const config = require('./config');

let onkernelClient = null;

if (config.onkernel.apiKey) {
  try {
    onkernelClient = new OnKernel({
      apiKey: config.onkernel.apiKey,
    });
    console.log('OnKernel client initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize OnKernel client:', error);
  }
} else {
  console.warn('ONKERNEL_API_KEY not found in environment. Feature flags will be disabled.');
}

/**
 * Checks if a feature flag is enabled.
 * @param {string} key - The key of the feature flag.
 * @param {object} context - The user or request context.
 * @param {boolean} defaultValue - The default value to return if the check fails.
 * @returns {Promise<boolean>} - True if the feature is enabled, otherwise false.
 */
async function isFeatureEnabled(key, context = {}, defaultValue = false) {
  if (!onkernelClient) {
    return defaultValue;
  }
  try {
    // Assuming the SDK method is isFeatureEnabled({ key, context })
    const enabled = await onkernelClient.isFeatureEnabled({ key, context });
    return enabled;
  } catch (error) {
    console.error(`Error checking OnKernel feature flag "${key}":`, error.message);
    return defaultValue;
  }
}

module.exports = {
  isFeatureEnabled,
};