# JS-Heavy Site Design Token Extraction Enhancements

## Overview

This document describes the enhancements made to improve design token extraction from modern, JavaScript-heavy SaaS websites. These improvements address the issue where design tokens were coming back empty or incomplete for sites using React, Next.js, Tailwind CSS, CSS-in-JS, and other dynamic rendering approaches.

## Problem Statement

The original crawler had difficulty extracting design tokens from:
- React/Next.js applications with dynamic rendering
- Sites using CSS-in-JS libraries (styled-components, emotion, etc.)
- Tailwind CSS applications
- Canvas/WebGL-rendered content
- Lazy-loaded or dynamically injected DOM elements

**Symptoms:**
- `designTokens` object was empty or sparse
- Screenshot-based extraction provided limited tokens
- LLM inference couldn't find enough context to infer tokens

## Solutions Implemented

### 1. Enhanced Wait Strategy for JS Rendering

**Problem:** Modern frameworks take time to hydrate and render content. The original 1-second wait was insufficient.

**Solution:**
```javascript
// Increased initial wait time
await page.waitForTimeout(2000); // Increased from 1000ms

// Wait for fonts to load (critical for typography tokens)
await page.evaluate(() => {
  return new Promise((resolve) => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        setTimeout(resolve, 500); // Additional buffer
      });
    } else {
      setTimeout(resolve, 500);
    }
  });
});

// Additional wait after lazy load
await this.handleLazyLoad(page);
await page.waitForTimeout(1000);
```

**Impact:** Ensures all dynamic content is fully rendered before extraction.

### 2. Stylesheet Rule Extraction

**Problem:** Only CSS variables were being extracted from stylesheets, missing actual style values.

**Solution:** Enhanced `extractCSSVariables()` to also extract design token values from stylesheet rules:

```javascript
// Extract from stylesheet rules (captures Tailwind, CSS-in-JS)
if (rule.style) {
  const style = rule.style;
  
  // Colors
  if (style.color) stylesheetRules.colors.add(style.color);
  if (style.backgroundColor) stylesheetRules.colors.add(style.backgroundColor);
  if (style.borderColor) stylesheetRules.colors.add(style.borderColor);
  if (style.fill) stylesheetRules.colors.add(style.fill);
  if (style.stroke) stylesheetRules.colors.add(style.stroke);
  
  // Typography
  if (style.fontFamily) stylesheetRules.fonts.add(style.fontFamily);
  if (style.fontSize) stylesheetRules.fontSizes.add(style.fontSize);
  
  // Spacing (including gap for flexbox/grid)
  if (style.padding) stylesheetRules.spacing.add(style.padding);
  if (style.margin) stylesheetRules.spacing.add(style.margin);
  if (style.gap) stylesheetRules.spacing.add(style.gap);
  
  // Border radius
  if (style.borderRadius) stylesheetRules.borderRadius.add(style.borderRadius);
  
  // Shadows (including text shadows)
  if (style.boxShadow) stylesheetRules.shadows.add(style.boxShadow);
  if (style.textShadow) stylesheetRules.shadows.add(style.textShadow);
}
```

**Impact:** Captures tokens from Tailwind utility classes and CSS-in-JS styles that are embedded in stylesheets.

### 3. Inline `<style>` Tag Extraction

**Problem:** CSS-in-JS libraries often inject styles via inline `<style>` tags, which weren't being parsed.

**Solution:** Added regex-based extraction from inline style tags:

```javascript
// Extract from inline <style> tags
const styleTags = Array.from(document.querySelectorAll('style'));
styleTags.forEach(styleTag => {
  const cssText = styleTag.textContent || '';
  
  // Extract color values using regex
  const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g;
  const colorMatches = cssText.match(colorRegex);
  if (colorMatches) {
    colorMatches.forEach(color => stylesheetRules.colors.add(color));
  }
  
  // Extract font families, sizes, border radius, shadows, etc.
  // ... (similar regex patterns for other properties)
});
```

**Impact:** Captures design tokens from CSS-in-JS libraries like styled-components, emotion, and similar.

### 4. Improved Visibility Detection

**Problem:** The original visibility check excluded elements with `opacity: 0`, which might still contribute valuable design tokens.

**Solution:** Made the visibility check more permissive:

```javascript
// Original (too strict)
return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

// Enhanced (more permissive)
return style && style.display !== 'none' && style.visibility !== 'hidden';
```

**Impact:** Elements with zero opacity or CSS transforms are now included in token extraction.

### 5. Merged Style Sources

**Problem:** Tokens from different sources (computed styles, stylesheets, inline styles) weren't being combined.

**Solution:** Merge all sources with deduplication:

```javascript
const mergedStyles = {
  colors: Array.from(new Set([
    ...(computedStyles.colors || []), 
    ...(stylesheetRules.colors || [])
  ])),
  fonts: Array.from(new Set([
    ...(computedStyles.fonts || []), 
    ...(stylesheetRules.fonts || [])
  ])),
  // ... similar for other properties
};
```

**Impact:** Comprehensive token extraction from all available sources.

### 6. Enhanced Data Return Structure

**Problem:** The return structure didn't clearly indicate which styles came from which sources.

**Solution:** Now returns `cssVariables` separately and uses merged styles for `computedStyles`:

```javascript
return {
  // ... other fields
  cssVariables,              // CSS custom properties
  computedStyles: mergedStyles,  // Merged from all sources
  designTokens,              // Processed and enriched tokens
  // ...
};
```

## Usage

The enhancements are automatically applied when using deep crawl mode:

```javascript
const crawler = require('./crawler');

await crawler.init();

const result = await crawler.crawlDeep('https://js-heavy-site.com', {
  takeScreenshot: true
});

console.log('Design Tokens:', result.designTokens);
// {
//   colors: [...],      // All unique colors
//   fonts: [...],       // All unique fonts
//   fontSizes: [...],   // All font sizes
//   spacing: [...],     // All spacing values
//   borderRadius: [...],// All border radius values
//   shadows: [...],     // All shadow values
//   cssVariables: {...} // CSS custom properties
// }
```

## Testing

New tests verify the enhanced extraction:

```bash
npm test -- crawler.js-heavy.test.js
```

Tests cover:
- Stylesheet rule extraction
- Enhanced visibility detection
- Style merging and deduplication
- Token extraction from various sources

## Configuration

Adjust wait times if needed via environment variables:

```bash
# Increase scroll steps for lazy loading
SCROLL_STEPS=5
SCROLL_DELAY_MS=1000

# Increase request timeout for slow sites
REQUEST_TIMEOUT_MS=90000
```

## Performance Considerations

The enhancements add:
- ~2-3 seconds to crawl time (for additional waits)
- Minimal CPU overhead for regex parsing
- No additional memory impact (Set-based deduplication)

**Recommended for:** JS-heavy SaaS sites, modern web apps
**Optional for:** Static HTML sites (use fast mode instead)

## Troubleshooting

### Still Getting Empty Tokens?

1. **Increase wait times:** Some sites need more time to render
   ```javascript
   await page.waitForTimeout(5000); // Increase to 5 seconds
   ```

2. **Check for CAPTCHA:** The crawler detects and warns about CAPTCHAs
   ```javascript
   if (result.captchaDetected) {
     console.log('CAPTCHA detected - manual intervention needed');
   }
   ```

3. **Enable LLM enrichment:** Ensure OpenAI API key is configured
   ```bash
   export OPENAI_API_KEY=your_key_here
   ```

4. **Use screenshot analysis:** Always enable screenshots for visual token extraction
   ```javascript
   await crawler.crawlDeep(url, { takeScreenshot: true });
   ```

### Sites Still Not Working?

Some sites may use advanced protection:
- Try rotating user agents: `ROTATE_USER_AGENTS=true`
- Try different browsers: `ROTATE_BROWSERS=true`
- Increase retry attempts: `RETRY_ATTEMPTS=5`

## Future Enhancements

Potential improvements for even better extraction:

1. **Advanced regex patterns** for modern CSS features (container queries, layers, etc.)
2. **Canvas/WebGL analysis** using computer vision
3. **Network request analysis** to capture tokens from API responses
4. **Source map parsing** for original style sources
5. **Framework-specific extractors** (React DevTools integration, etc.)

## Related Files

- `crawler.js` - Main implementation
- `__tests__/crawler.js-heavy.test.js` - Test suite
- `llm.js` - LLM enrichment logic
- `config.js` - Configuration options
