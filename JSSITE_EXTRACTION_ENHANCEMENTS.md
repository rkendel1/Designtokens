# JS-Heavy Site Design Token Extraction Enhancements

## Overview

This document describes the enhancements made to improve design token extraction from modern, JavaScript-heavy SaaS websites. These improvements address the issue where design tokens were coming back empty or incomplete for sites using React, Next.js, Tailwind CSS, CSS-in-JS, and other dynamic rendering approaches.

## Latest Enhancements (v2)

The crawler now includes **5 major new capabilities** for extracting design tokens from JS-heavy SaaS sites:

1. **Tailwind Class Resolver** - Automatically resolves Tailwind CSS utility classes to their actual CSS values
2. **Hidden Element Capture** - Captures design tokens from modals, dropdowns, tooltips, and other initially-hidden interactive elements
3. **Section-Level Screenshots** - Extracts colors from individual page sections for more granular token discovery
4. **Enriched LLM Context** - Provides comprehensive context to LLM including resolved classes, screenshot colors, and all style sources
5. **Complete Token Merging** - Merges tokens from all sources (computed, stylesheets, Tailwind, screenshots, sections, LLM) with deduplication

These enhancements build upon the existing extraction capabilities to provide the most comprehensive design token extraction available.

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

### 1. Tailwind Class Resolver (NEW)

**Problem:** Tailwind CSS and utility-first frameworks embed styles in class names rather than CSS rules, making them harder to extract.

**Solution:**
```javascript
// Resolve Tailwind and utility classes to actual CSS values
async resolveTailwindClasses(page) {
  return await page.evaluate(() => {
    // Map Tailwind class patterns to computed CSS values
    const tailwindPatterns = {
      color: /(?:bg|text|border)-(\w+)-(\d+)/,
      spacing: /(?:p|m|px|py|pl|pr|pt|pb|mx|my|ml|mr|mt|mb)-(\d+|auto)/,
      borderRadius: /rounded(?:-(\w+))?/,
      shadow: /shadow-(\w+)/,
      fontSize: /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/,
      fontFamily: /font-(sans|serif|mono)/
    };
    
    // For each element with Tailwind classes, resolve to computed CSS
    elementsWithClasses.forEach(el => {
      const classList = el.className.split(/\s+/);
      const computed = getComputedStyle(el);
      
      classList.forEach(className => {
        if (tailwindPatterns.color.test(className)) {
          // Extract resolved color from computed styles
          if (className.startsWith('bg-')) {
            resolvedClasses.colors.add(computed.backgroundColor);
          }
          // ... similar for other Tailwind utilities
        }
      });
    });
  });
}
```

**Impact:** Captures design tokens from Tailwind and other utility-first CSS frameworks by resolving class names to actual CSS values.

### 2. Hidden and Interactive Element Capture (NEW)

**Problem:** Modals, dropdowns, tooltips, and other interactive elements are often hidden until interaction, causing their design tokens to be missed.

**Solution:**
```javascript
// Enhanced visibility check to include hidden but interactable elements
function isVisibleOrInteractable(el) {
  const style = getComputedStyle(el);
  
  // Include visible elements
  if (style && style.display !== 'none' && style.visibility !== 'hidden') {
    return true;
  }
  
  // Include hidden elements that are interactable
  const interactableSelectors = [
    '[role="dialog"]', '[role="menu"]', '[role="tooltip"]',
    '[aria-hidden="true"]', '.modal', '.dropdown', '.popover', 
    '.tooltip', '[data-modal]', '[data-dropdown]'
  ];
  
  for (const selector of interactableSelectors) {
    if (el.matches(selector) || el.querySelector(selector)) {
      return true;
    }
  }
  
  // Include elements with transition/animation (likely to appear)
  if (style.transition !== 'all 0s ease 0s' || style.animation !== 'none') {
    return true;
  }
  
  return false;
}
```

**Impact:** Captures tokens from modals, dropdowns, tooltips, and other interactive UI components even when they're initially hidden.

### 3. Section-Level Screenshot Color Extraction (NEW)

**Problem:** Full-page screenshots can miss section-specific color palettes and gradients used in different parts of the page.

**Solution:**
```javascript
// Extract colors from individual page sections
async extractSectionColors(page) {
  const sections = await page.$$('section, [role="main"], main, article, .container');
  const sectionColors = new Set();
  
  // Process first 5 sections
  for (const section of sections.slice(0, 5)) {
    const screenshot = await section.screenshot({ type: 'png' });
    // Use ColorThief to extract dominant colors
    const palette = await ColorThief.getPalette(tmpFile, 5);
    palette.forEach(rgb => {
      sectionColors.add(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
    });
  }
  
  return Array.from(sectionColors);
}
```

**Impact:** Captures section-specific color palettes, gradients, and visual elements that might be missed in full-page analysis.

### 4. Enriched LLM Context (NEW)

**Problem:** LLM needed more comprehensive context to accurately infer design tokens from complex, modern web applications.

**Solution:**
```javascript
// Create enriched context with all available style information
const enrichedContext = {
  ...mergedStyles,
  tailwindResolved: tailwindResolved,      // Resolved Tailwind classes
  screenshotColors: screenshotColors,      // Full-page screenshot colors
  sectionColors: sectionColors,            // Section-level colors
  cssVariables: cssVariables               // CSS custom properties
};

// Pass enriched context to LLM for inference
const llmDesignTokens = await this.llm.inferDesignTokensFromLLM(html, enrichedContext);
```

**Impact:** Provides LLM with comprehensive context including resolved utility classes, visual colors, and all extracted styles for better token inference.

### 5. Complete Token Merging (NEW)

**Problem:** Tokens from different sources weren't being comprehensively merged and deduplicated.

**Solution:**
```javascript
// Merge all token sources with deduplication
const mergedStyles = {
  colors: Array.from(new Set([
    ...(computedStyles.colors || []), 
    ...(stylesheetRules.colors || []),
    ...(tailwindResolved.colors || [])
  ])),
  // ... similar for other properties
};

// Then merge with screenshot and section colors
designTokens.colors = Array.from(new Set([
  ...(designTokens.colors || []),
  ...screenshotColors,
  ...sectionColors
]));
```

**Impact:** Ensures all design tokens from every source are captured and deduplicated for comprehensive coverage.

### 6. Enhanced Wait Strategy for JS Rendering

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

### 7. Stylesheet Rule Extraction

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

### 8. Inline `<style>` Tag Extraction

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

### 9. Improved Visibility Detection

**Problem:** The original visibility check excluded elements with `opacity: 0`, which might still contribute valuable design tokens.

**Solution:** Made the visibility check more permissive:

```javascript
// Original (too strict)
return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

// Enhanced (more permissive)
return style && style.display !== 'none' && style.visibility !== 'hidden';
```

**Impact:** Elements with zero opacity or CSS transforms are now included in token extraction.

### 10. Legacy Merged Style Sources

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

### 11. Enhanced Data Return Structure

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
