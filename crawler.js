import { chromium, firefox, webkit } from 'playwright';
import { Kernel } from '@onkernel/sdk';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import axios from 'axios';
import config from './config.js';
import llm from './llm.js';
import { extractColorPalette } from './image-processor.js';

// User agent pool for rotation
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  // Chrome on Android
  'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  // Safari on iOS
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
];

class Crawler {
  constructor() {
    this.browser = null;
    this.browserType = null;
    this.userAgentIndex = 0;
    this.llm = llm;
    this.kernel = null;
    if (config.onkernel.apiKey) {
      try {
        this.kernel = new Kernel({ apiKey: config.onkernel.apiKey });
        console.log('OnKernel Kernel for browsers initialized.');
      } catch (error) {
        console.error('Failed to initialize OnKernel Kernel for browsers:', error);
      }
    }
  }

  // Get random user agent
  getRandomUserAgent() {
    if (config.crawler.rotateUserAgents) {
      const agent = USER_AGENTS[this.userAgentIndex % USER_AGENTS.length];
      this.userAgentIndex++;
      return agent;
    }
    return config.crawler.userAgent;
  }

  // Get browser type to use
  getBrowserType() {
    const browserType = config.crawler.browser;
    
    if (browserType === 'random' || config.crawler.rotateBrowsers) {
      const browsers = ['chromium', 'firefox', 'webkit'];
      return browsers[Math.floor(Math.random() * browsers.length)];
    }
    
    return browserType;
  }

  // Launch appropriate browser
  async launchBrowser(type) {
    // If OnKernel is configured and we are asked for a chromium browser, use OnKernel.
    if (this.kernel && type === 'chromium') {
      try {
        console.log('Launching browser via OnKernel...');
        const kernelBrowser = await this.kernel.browsers.create();
        const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
        // Store kernelBrowser details for later cleanup
        browser.kernelBrowser = kernelBrowser;
        return browser;
      } catch (error) {
        console.error('Failed to launch browser with OnKernel, falling back to local Playwright.', error);
        // Fall through to local launch
      }
    }

    // Fallback for other browsers, or if OnKernel is not configured, or if OnKernel fails.
    if (this.kernel && type !== 'chromium') {
      console.warn(`OnKernel browser launch is currently only supported for Chromium. Launching ${type} locally.`);
    } else if (!this.kernel) {
      console.log('OnKernel not configured. Launching browser locally.');
    }
    
    const browserMap = {
      chromium: chromium,
      firefox: firefox,
      webkit: webkit
    };

    const browserEngine = browserMap[type] || chromium;
    
    return await browserEngine.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async init() {
    if (!this.browser) {
      this.browserType = this.getBrowserType();
      this.browser = await this.launchBrowser(this.browserType);
    }
  }

  async close() {
    if (this.browser) {
      if (this.browser.kernelBrowser && this.kernel) {
        try {
          console.log('Destroying OnKernel browser session...');
          await this.kernel.browsers.destroy(this.browser.kernelBrowser.id);
        } catch (error) {
          console.error('Failed to destroy OnKernel browser session:', error);
        }
      }
      await this.browser.close();
      this.browser = null;
      this.browserType = null;
    }
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retry logic wrapper
  async withRetry(fn, attempts = config.crawler.retryAttempts) {
    let lastError;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${i + 1} failed: ${error.message}`);
        
        if (i < attempts - 1) {
          await this.sleep(config.crawler.retryDelay * (i + 1)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  // Handle lazy-loaded content by scrolling
  async handleLazyLoad(page) {
    if (!config.crawler.handleLazyLoad) {
      return;
    }

    const scrollSteps = config.crawler.scrollSteps;
    const scrollDelay = config.crawler.scrollDelay;

    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate(({ step, total }) => {
        const scrollHeight = document.body.scrollHeight;
        const stepHeight = scrollHeight / total;
        window.scrollTo(0, stepHeight * (step + 1));
      }, { step: i, total: scrollSteps });
      
      await this.sleep(scrollDelay);
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await this.sleep(scrollDelay);
  }

  // Detect CAPTCHA on page
  async detectCaptcha(page) {
    const captchaIndicators = await page.evaluate(() => {
      const body = document.body.innerHTML.toLowerCase();
      const indicators = [
        body.includes('recaptcha'),
        body.includes('captcha'),
        body.includes('hcaptcha'),
        body.includes('cloudflare'),
        document.querySelector('iframe[src*="recaptcha"]') !== null,
        document.querySelector('iframe[src*="hcaptcha"]') !== null,
        document.querySelector('[class*="captcha"]') !== null
      ];
      
      return indicators.some(indicator => indicator);
    });

    return captchaIndicators;
  }

  // Check robots.txt compliance
  async checkRobots(url) {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        const robots = robotsParser(robotsUrl, response.data);
        return robots.isAllowed(url, config.crawler.userAgent);
      }
      
      // If no robots.txt, assume allowed
      return true;
    } catch (error) {
      // If robots.txt doesn't exist or error, assume allowed
      return true;
    }
  }

  // Resolve Tailwind and utility classes to CSS values
  async resolveTailwindClasses(page) {
    return await page.evaluate(() => {
      const resolvedClasses = {
        colors: new Set(),
        fonts: new Set(),
        fontSizes: new Set(),
        spacing: new Set(),
        borderRadius: new Set(),
        shadows: new Set()
      };

      // Common Tailwind patterns to resolve
      const tailwindPatterns = {
        // Color patterns: bg-{color}-{shade}, text-{color}-{shade}
        color: /(?:bg|text|border)-(\w+)-(\d+)/,
        // Spacing: p-{size}, m-{size}, px-{size}, py-{size}, etc.
        spacing: /(?:p|m|px|py|pl|pr|pt|pb|mx|my|ml|mr|mt|mb)-(\d+|auto)/,
        // Border radius: rounded-{size}
        borderRadius: /rounded(?:-(\w+))?/,
        // Shadow: shadow-{size}
        shadow: /shadow-(\w+)/,
        // Font size: text-{size}
        fontSize: /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/,
        // Font family: font-{family}
        fontFamily: /font-(sans|serif|mono)/
      };

      // Get all elements with classes
      const elementsWithClasses = Array.from(document.querySelectorAll('[class]'));
      
      elementsWithClasses.forEach(el => {
        const classString = (typeof el.className === 'string') ? el.className : (el.className.baseVal || '');
        const classList = classString.split(/\s+/);
        const computed = getComputedStyle(el);
        
        classList.forEach(className => {
          // Check if it's a Tailwind utility class and get computed value
          if (tailwindPatterns.color.test(className)) {
            if (className.startsWith('bg-')) {
              const bgColor = computed.backgroundColor;
              if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                resolvedClasses.colors.add(bgColor);
              }
            } else if (className.startsWith('text-')) {
              const textColor = computed.color;
              if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
                resolvedClasses.colors.add(textColor);
              }
            } else if (className.startsWith('border-')) {
              const borderColor = computed.borderColor;
              if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
                resolvedClasses.colors.add(borderColor);
              }
            }
          }
          
          if (tailwindPatterns.spacing.test(className)) {
            if (className.startsWith('p')) {
              const padding = computed.padding;
              if (padding && padding !== '0px') resolvedClasses.spacing.add(padding);
            } else if (className.startsWith('m')) {
              const margin = computed.margin;
              if (margin && margin !== '0px') resolvedClasses.spacing.add(margin);
            }
          }
          
          if (tailwindPatterns.borderRadius.test(className)) {
            const borderRadius = computed.borderRadius;
            if (borderRadius && borderRadius !== '0px') {
              resolvedClasses.borderRadius.add(borderRadius);
            }
          }
          
          if (tailwindPatterns.shadow.test(className)) {
            const boxShadow = computed.boxShadow;
            if (boxShadow && boxShadow !== 'none') {
              resolvedClasses.shadows.add(boxShadow);
            }
          }
          
          if (tailwindPatterns.fontSize.test(className)) {
            const fontSize = computed.fontSize;
            if (fontSize) resolvedClasses.fontSizes.add(fontSize);
          }
          
          if (tailwindPatterns.fontFamily.test(className)) {
            const fontFamily = computed.fontFamily;
            if (fontFamily) resolvedClasses.fonts.add(fontFamily);
          }
        });
      });

      return {
        colors: Array.from(resolvedClasses.colors).filter(Boolean),
        fonts: Array.from(resolvedClasses.fonts).filter(Boolean),
        fontSizes: Array.from(resolvedClasses.fontSizes).filter(Boolean),
        spacing: Array.from(resolvedClasses.spacing).filter(Boolean),
        borderRadius: Array.from(resolvedClasses.borderRadius).filter(Boolean),
        shadows: Array.from(resolvedClasses.shadows).filter(Boolean)
      };
    });
  }

  // Extract CSS variables and stylesheet rules from page
  async extractCSSVariables(page) {
    return await page.evaluate(() => {
      const variables = {};
      const stylesheetRules = {
        colors: new Set(),
        fonts: new Set(),
        fontSizes: new Set(),
        spacing: new Set(),
        borderRadius: new Set(),
        shadows: new Set()
      };
      
      const sheets = Array.from(document.styleSheets);
      
      sheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => {
            if (rule.style) {
              // Extract CSS variables
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) {
                  variables[prop] = rule.style.getPropertyValue(prop).trim();
                }
              }
              
              // Extract design token values from stylesheet rules
              // This captures Tailwind, CSS-in-JS, and other styles that may not be in computed styles
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
              
              // Spacing
              if (style.padding) stylesheetRules.spacing.add(style.padding);
              if (style.margin) stylesheetRules.spacing.add(style.margin);
              if (style.gap) stylesheetRules.spacing.add(style.gap);
              
              // Border radius
              if (style.borderRadius) stylesheetRules.borderRadius.add(style.borderRadius);
              
              // Shadows
              if (style.boxShadow) stylesheetRules.shadows.add(style.boxShadow);
              if (style.textShadow) stylesheetRules.shadows.add(style.textShadow);
            }
          });
        } catch (e) {
          // CORS or security errors, skip
        }
      });
      
      // Also extract from inline <style> tags which may contain CSS-in-JS or Tailwind
      const styleTags = Array.from(document.querySelectorAll('style'));
      styleTags.forEach(styleTag => {
        const cssText = styleTag.textContent || '';
        
        // Extract color values using regex
        const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g;
        const colorMatches = cssText.match(colorRegex);
        if (colorMatches) {
          colorMatches.forEach(color => stylesheetRules.colors.add(color));
        }
        
        // Extract font families
        const fontFamilyRegex = /font-family\s*:\s*([^;]+)/gi;
        let fontMatch;
        while ((fontMatch = fontFamilyRegex.exec(cssText)) !== null) {
          stylesheetRules.fonts.add(fontMatch[1].trim());
        }
        
        // Extract font sizes
        const fontSizeRegex = /font-size\s*:\s*([^;]+)/gi;
        let sizeMatch;
        while ((sizeMatch = fontSizeRegex.exec(cssText)) !== null) {
          stylesheetRules.fontSizes.add(sizeMatch[1].trim());
        }
        
        // Extract border radius
        const borderRadiusRegex = /border-radius\s*:\s*([^;]+)/gi;
        let radiusMatch;
        while ((radiusMatch = borderRadiusRegex.exec(cssText)) !== null) {
          stylesheetRules.borderRadius.add(radiusMatch[1].trim());
        }
        
        // Extract box shadows
        const boxShadowRegex = /box-shadow\s*:\s*([^;]+)/gi;
        let shadowMatch;
        while ((shadowMatch = boxShadowRegex.exec(cssText)) !== null) {
          stylesheetRules.shadows.add(shadowMatch[1].trim());
        }
      });
      
      // Also check :root computed styles
      const root = document.documentElement;
      const rootStyles = getComputedStyle(root);
      for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (prop.startsWith('--')) {
          variables[prop] = rootStyles.getPropertyValue(prop).trim();
        }
      }
      
      return {
        variables,
        stylesheetRules: {
          colors: Array.from(stylesheetRules.colors).filter(Boolean),
          fonts: Array.from(stylesheetRules.fonts).filter(Boolean),
          fontSizes: Array.from(stylesheetRules.fontSizes).filter(Boolean),
          spacing: Array.from(stylesheetRules.spacing).filter(Boolean),
          borderRadius: Array.from(stylesheetRules.borderRadius).filter(Boolean),
          shadows: Array.from(stylesheetRules.shadows).filter(Boolean)
        }
      };
    });
  }

  /**
   * Enhanced design token extraction for modern JS-heavy SaaS pages:
   * - Traverses all visible and hidden/interactable elements in the body.
   * - Aggregates inline styles, computed styles, and pseudo-element styles where possible.
   * - Collects all unique colors, fonts, font sizes, spacing, border radius, and shadows.
   * - Ensures full coverage for highly dynamic, componentized, JS-heavy UIs.
   */
  async extractComputedStyles(page) {
    return await page.evaluate(() => {
      // Helper to check if an element is visible or interactable
      // Enhanced to capture hidden elements that may become visible on interaction
      function isVisibleOrInteractable(el) {
        if (!el || !(el instanceof Element)) return false;
        const style = getComputedStyle(el);
        
        // Include visible elements
        if (style && style.display !== 'none' && style.visibility !== 'hidden') {
          return true;
        }
        
        // Include hidden elements that are interactable (modals, dropdowns, tooltips, etc.)
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
        
        // Include elements with transition/animation properties (likely to appear)
        if (style.transition !== 'all 0s ease 0s' || style.animation !== 'none') {
          return true;
        }
        
        return false;
      }

      // Sets for deduplication
      const styles = {
        colors: new Set(),
        fonts: new Set(),
        fontSizes: new Set(),
        spacing: new Set(),
        borderRadius: new Set(),
        shadows: new Set()
      };

      // Traverse all visible and interactable elements in body
      const allElements = Array.from(document.body.querySelectorAll('*')).filter(isVisibleOrInteractable);
      // Always include body itself
      allElements.unshift(document.body);

      allElements.forEach(el => {
        const computed = getComputedStyle(el);
        // Colors
        const color = computed.color;
        const bgColor = computed.backgroundColor;
        const borderColor = computed.borderColor;
        if (color && color !== 'rgba(0, 0, 0, 0)') styles.colors.add(color);
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') styles.colors.add(bgColor);
        if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') styles.colors.add(borderColor);

        // Typography
        if (computed.fontFamily) styles.fonts.add(computed.fontFamily);
        if (computed.fontSize) styles.fontSizes.add(computed.fontSize);

        // Spacing
        if (computed.padding && computed.padding !== '0px') styles.spacing.add(computed.padding);
        if (computed.margin && computed.margin !== '0px') styles.spacing.add(computed.margin);

        // Border radius
        if (computed.borderRadius && computed.borderRadius !== '0px') styles.borderRadius.add(computed.borderRadius);

        // Shadows
        if (computed.boxShadow && computed.boxShadow !== 'none') styles.shadows.add(computed.boxShadow);

        // Inline style values for all relevant properties
        if (el.style) {
          if (el.style.color) styles.colors.add(el.style.color);
          if (el.style.backgroundColor) styles.colors.add(el.style.backgroundColor);
          if (el.style.borderColor) styles.colors.add(el.style.borderColor);
          if (el.style.fontFamily) styles.fonts.add(el.style.fontFamily);
          if (el.style.fontSize) styles.fontSizes.add(el.style.fontSize);
          if (el.style.padding) styles.spacing.add(el.style.padding);
          if (el.style.margin) styles.spacing.add(el.style.margin);
          if (el.style.borderRadius) styles.borderRadius.add(el.style.borderRadius);
          if (el.style.boxShadow) styles.shadows.add(el.style.boxShadow);
        }

        // Try to get pseudo-element styles (:before and :after)
        ['::before', '::after'].forEach(pseudo => {
          try {
            const pseudoComputed = getComputedStyle(el, pseudo);
            if (pseudoComputed) {
              const pColor = pseudoComputed.color;
              const pBg = pseudoComputed.backgroundColor;
              const pBorderColor = pseudoComputed.borderColor;
              if (pColor && pColor !== 'rgba(0, 0, 0, 0)') styles.colors.add(pColor);
              if (pBg && pBg !== 'rgba(0, 0, 0, 0)' && pBg !== 'transparent') styles.colors.add(pBg);
              if (pBorderColor && pBorderColor !== 'rgba(0, 0, 0, 0)') styles.colors.add(pBorderColor);
              if (pseudoComputed.fontFamily) styles.fonts.add(pseudoComputed.fontFamily);
              if (pseudoComputed.fontSize) styles.fontSizes.add(pseudoComputed.fontSize);
              if (pseudoComputed.padding && pseudoComputed.padding !== '0px') styles.spacing.add(pseudoComputed.padding);
              if (pseudoComputed.margin && pseudoComputed.margin !== '0px') styles.spacing.add(pseudoComputed.margin);
              if (pseudoComputed.borderRadius && pseudoComputed.borderRadius !== '0px') styles.borderRadius.add(pseudoComputed.borderRadius);
              if (pseudoComputed.boxShadow && pseudoComputed.boxShadow !== 'none') styles.shadows.add(pseudoComputed.boxShadow);
            }
          } catch (e) {
            // Some browsers throw on certain pseudo-elements, skip
          }
        });
      });

      // Return arrays for serialization
      return {
        colors: Array.from(styles.colors).filter(Boolean),
        fonts: Array.from(styles.fonts).filter(Boolean),
        fontSizes: Array.from(styles.fontSizes).filter(Boolean),
        spacing: Array.from(styles.spacing).filter(Boolean),
        borderRadius: Array.from(styles.borderRadius).filter(Boolean),
        shadows: Array.from(styles.shadows).filter(Boolean)
      };
    });
  }

  // Extract colors from section-level screenshots
  async extractSectionColors(page) {
    try {
      const sections = await page.$$('section, [role="main"], main, article, .container, [class*="section"]');
      const sectionColors = new Set();
      
      // Limit to first 5 sections to avoid performance issues
      const sectionsToProcess = sections.slice(0, 5);
      
      for (const section of sectionsToProcess) {
        try {
          const screenshot = await section.screenshot({ type: 'png' });
          const palette = await extractColorPalette(screenshot, 5); // 5 clusters
          palette.forEach(color => sectionColors.add(color));
        } catch (e) {
          // Skip sections that fail to screenshot
          continue;
        }
      }
      
      return Array.from(sectionColors);
    } catch (error) {
      console.warn('Section-level color extraction failed:', error.message);
      return [];
    }
  }

  // Extract logo and favicon
  async extractLogoAndFavicon(page, baseUrl) {
    return await page.evaluate((baseUrl) => {
      const toAbsolute = (url) => {
        if (!url || url.startsWith('data:')) return null;
        try {
          return new URL(url, baseUrl).href;
        } catch (e) {
          return null;
        }
      };

      // Find logo
      let logoUrl = null;
      const logoSelectors = [
        // High confidence selectors
        'img[alt*="logo" i]',
        'img[src*="logo"]',
        'a[class*="logo"] img',
        '[class*="logo"] img',
        // Medium confidence selectors for images inside header/banner links
        'header a[href="/"] img',
        '[role="banner"] a[href="/"] img',
        'header > a > img',
        // Lower confidence, but common
        'header img',
        // SVG with a src attribute (not inline)
        'svg[aria-label*="logo" i]',
      ];
      for (const selector of logoSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          logoUrl = toAbsolute(el.src || el.getAttribute('href'));
          if (logoUrl) break;
        }
      }

      // Find favicon
      let faviconUrl = null;
      const faviconSelectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ];
      for (const selector of faviconSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          faviconUrl = toAbsolute(el.href);
          if (faviconUrl) break;
        }
      }
      if (!faviconUrl) {
        faviconUrl = toAbsolute('/favicon.ico');
      }

      return { logoUrl, faviconUrl };
    }, baseUrl);
  }

  // Extract hero image
  async extractHeroImage(page, baseUrl) {
    return await page.evaluate((baseUrl) => {
      const toAbsolute = (url) => {
        if (!url || url.startsWith('data:')) return null;
        try {
          return new URL(url, baseUrl).href;
        } catch (e) {
          return null;
        }
      };

      const images = Array.from(document.querySelectorAll('main img, header img'));
      let largestImage = null;
      let maxArea = 0;

      for (const img of images) {
        const area = img.naturalWidth * img.naturalHeight;
        if (area > maxArea) {
          maxArea = area;
          largestImage = img;
        }
      }

      return largestImage ? toAbsolute(largestImage.src) : null;
    }, baseUrl);
  }

  // Extract structured data using Cheerio
  extractStructuredData(html) {
    const $ = cheerio.load(html);
    const data = {
      emails: new Set(),
      phones: new Set(),
      socialLinks: [],
      products: [],
      addresses: new Set()
    };

    // NOTE: A deep crawl is needed to capture JS-rendered content and emails/phones injected by JavaScript.
    // This function only extracts what is present in the static HTML.

    // Improved Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    // Improved Phone regex
    const phoneRegex = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

    // Extract from text
    const bodyText = $('body').text();
    const emailMatches = bodyText.match(emailRegex);
    const phoneMatches = bodyText.match(phoneRegex);
    
    if (emailMatches) {
      emailMatches.forEach(email => data.emails.add(email));
    }
    if (phoneMatches) {
      phoneMatches.forEach(phone => data.phones.add(phone.trim()));
    }

    // Extract from mailto and tel links
    $('a[href^="mailto:"]').each((i, el) => {
      const email = $(el).attr('href').replace('mailto:', '').split('?')[0];
      data.emails.add(email);
    });

    $('a[href^="tel:"]').each((i, el) => {
      const phone = $(el).attr('href').replace('tel:', '');
      data.phones.add(phone);
    });

    // Social links
    const socialDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 
                          'youtube.com', 'github.com', 'tiktok.com', 'pinterest.com'];
    const seenSocials = new Set();
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        socialDomains.forEach(domain => {
          if (href.includes(domain) && !seenSocials.has(href)) {
            data.socialLinks.push({ platform: domain.replace('.com', ''), url: href });
            seenSocials.add(href);
          }
        });
      }
    });

    // Extract potential products (basic heuristic)
    $('.product, .item, [class*="product"]').each((i, el) => {
      const name = $(el).find('.name, .title, h2, h3').first().text().trim();
      const price = $(el).find('.price, [class*="price"]').first().text().trim();
      const link = $(el).find('a').first().attr('href');
      
      if (name) {
        data.products.push({
          name,
          price: price || null,
          url: link || null
        });
      }
    });

    // Extract products from <script type="application/ld+json"> blocks
    $('script[type="application/ld+json"]').each((i, el) => {
      let json;
      try {
        json = $(el).contents().text();
        if (!json) return;
        let parsed;
        try {
          parsed = JSON.parse(json);
        } catch (err) {
          // Try to handle multiple JSON objects in array
          if (json.trim().startsWith('[') && json.trim().endsWith(']')) {
            try {
              parsed = JSON.parse(json);
            } catch {
              return; // Invalid JSON, skip
            }
          } else {
            return; // Invalid JSON, skip
          }
        }
        // Product(s) may be a single object or array
        const products = Array.isArray(parsed) ? parsed : [parsed];
        products.forEach(obj => {
          if (obj && (obj['@type'] === 'Product' || (Array.isArray(obj['@type']) && obj['@type'].includes('Product')))) {
            data.products.push(obj);
          }
          // Sometimes Product is nested in @graph or itemListElement
          if (obj && Array.isArray(obj['@graph'])) {
            obj['@graph'].forEach(g => {
              if (g && (g['@type'] === 'Product' || (Array.isArray(g['@type']) && g['@type'].includes('Product')))) {
                data.products.push(g);
              }
            });
          }
        });
      } catch (e) {
        // Safe fallback: ignore malformed JSON-LD blocks
        return;
      }
    });

    // Extract meta information
    const metaData = {
      title: ($('title').text() || '').split('|')[0].trim(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || ''
    };

    // Return with sets converted to arrays for serialization
    return {
      ...data,
      emails: Array.from(data.emails),
      phones: Array.from(data.phones),
      addresses: Array.from(data.addresses),
      meta: metaData
    };
  }

  // Fast crawl mode: fetch static HTML and extract structured data
  async crawlFast(url) {
    // Check robots.txt
    const allowed = await this.checkRobots(url);
    if (!allowed) {
      throw new Error('Crawling not allowed by robots.txt');
    }
    // Use Axios to fetch HTML
    const headers = {
      'User-Agent': this.getRandomUserAgent()
    };
    const response = await axios.get(url, {
      headers,
      timeout: config.crawler.requestTimeout
    });
    const html = response.data;
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    // Use Cheerio for structured data extraction
    const structuredData = this.extractStructuredData(html) || {};
    const meta = structuredData.meta || {};
    const textContent = cheerio.load(html)('body').text() || "";
    return {
      url,
      domain,
      html,
      structuredData,
      meta,
      textContent,
      mode: 'fast'
    };
  }

  // --- Deep crawl mode with JSON sanitization for Postgres and base64 screenshots ---
  async crawlDeep(url, options = {}) {
    const { takeScreenshot = true } = options;
    const isLlmConfigured = config.openai.apiKey && config.openai.apiKey.startsWith('sk-');
    // Check robots.txt
    const allowed = await this.checkRobots(url);
    if (!allowed) {
      throw new Error('Crawling not allowed by robots.txt');
    }
    await this.init();
    // Helper to sanitize objects for JSON/PG
    function sanitizeForJson(obj) {
      // Recursively replace undefined/NaN with null, and ensure arrays/objects are valid
      if (obj === undefined || (typeof obj === 'number' && isNaN(obj))) return null;
      if (Array.isArray(obj)) {
        return obj.map(sanitizeForJson);
      }
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            const value = obj[k];
            out[k] = sanitizeForJson(value);
          }
        }
        return out;
      }
      return obj;
    }
    // Safe JSON wrapper for final output
    function safeJson(obj) {
      // Recursively sanitize, then use JSON roundtrip to remove undefined/NaN/cyclic/invalid
      return JSON.parse(JSON.stringify(sanitizeForJson(obj)));
    }
    // The following approach ensures full coverage for JS-heavy, modern SaaS pages.
    return await this.withRetry(async () => {
      const context = await this.browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: this.getRandomUserAgent()
      });
      const page = await context.newPage();
      try {
        // Block unnecessary resources to speed up crawling
        await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,mp4,webm,woff,woff2}', route => route.abort());

        // Navigate and wait for network idle
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: config.crawler.requestTimeout
        });
        // Wait for main content to load to capture JS-injected DOM
        await page.waitForSelector('main, header, footer', { timeout: 5000 }).catch(() => {});
        // Enhanced wait strategy for JS-heavy sites
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
          return new Promise((resolve) => {
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(() => {
                setTimeout(resolve, 500);
              });
            } else {
              setTimeout(resolve, 500);
            }
          });
        });
        const hasCaptcha = await this.detectCaptcha(page);
        if (hasCaptcha) console.warn(`CAPTCHA detected on ${url}`);
        await this.handleLazyLoad(page);
        await page.waitForTimeout(1000);
        const html = await page.content();
        const { logoUrl, faviconUrl } = await this.extractLogoAndFavicon(page, url);
        const heroImageUrl = await this.extractHeroImage(page, url);
        const cssData = await this.extractCSSVariables(page);
        const cssVariables = cssData.variables || {};
        const stylesheetRules = cssData.stylesheetRules || {};
        const computedStyles = await this.extractComputedStyles(page);
        const tailwindResolved = await this.resolveTailwindClasses(page);
        const mergedStyles = {
          colors: Array.from(new Set([
            ...(computedStyles.colors || []),
            ...(stylesheetRules.colors || []),
            ...(tailwindResolved.colors || [])
          ])),
          fonts: Array.from(new Set([
            ...(computedStyles.fonts || []),
            ...(stylesheetRules.fonts || []),
            ...(tailwindResolved.fonts || [])
          ])),
          fontSizes: Array.from(new Set([
            ...(computedStyles.fontSizes || []),
            ...(stylesheetRules.fontSizes || []),
            ...(tailwindResolved.fontSizes || [])
          ])),
          spacing: Array.from(new Set([
            ...(computedStyles.spacing || []),
            ...(stylesheetRules.spacing || []),
            ...(tailwindResolved.spacing || [])
          ])),
          borderRadius: Array.from(new Set([
            ...(computedStyles.borderRadius || []),
            ...(stylesheetRules.borderRadius || []),
            ...(tailwindResolved.borderRadius || [])
          ])),
          shadows: Array.from(new Set([
            ...(computedStyles.shadows || []),
            ...(stylesheetRules.shadows || []),
            ...(tailwindResolved.shadows || [])
          ]))
        };
        // --- Separate design tokens for easier access ---
        let designTokens = {
          colors: this.extractMajorColors(mergedStyles),
          fonts: this.extractMajorFonts(mergedStyles),
          fontSizes: mergedStyles.fontSizes || [],
          spacing: this.extractSpacingScale(mergedStyles),
          borderRadius: mergedStyles.borderRadius || [],
          shadows: mergedStyles.shadows || [],
          cssVariables: cssVariables || {}
        };
        let screenshot = null;
        let screenshotColors = [];
        let sectionColors = [];
        if (takeScreenshot) {
          screenshot = await page.screenshot({ fullPage: true, type: 'png' });
          try {
            screenshotColors = await extractColorPalette(screenshot, 8);
          } catch (e) {
            console.warn('Screenshot-based color extraction failed:', e.message);
            screenshotColors = [];
          }
          try {
            sectionColors = await this.extractSectionColors(page);
          } catch (e) {
            console.warn('Section-level color extraction failed:', e.message);
          }
          designTokens.colors = Array.from(new Set([
            ...(designTokens.colors || []),
            ...screenshotColors,
            ...sectionColors
          ]));
        }
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const structuredData = this.extractStructuredData(html) || {};
        // Additional pseudo-products detection for JS-heavy SaaS sites
        const featureSections = await page.$$eval('section, div', divs =>
          divs.map(d => {
            const titleEl = d.querySelector('h2,h3');
            const buttonEl = d.querySelector('a');
            const title = titleEl ? titleEl.innerText.trim() : '';
            const link = buttonEl ? buttonEl.href : null;
            return title ? { name: title, url: link } : null;
          }).filter(item => item)
        );
        structuredData.products = structuredData.products || [];
        structuredData.products.push(...featureSections);
        // --- LLM ENRICHMENT ---
        if (this.llm && isLlmConfigured) {
          try {
            const enrichedContext = {
              ...mergedStyles,
              tailwindResolved: tailwindResolved,
              screenshotColors: screenshotColors,
              sectionColors: sectionColors,
              cssVariables: cssVariables
            };
            const llmDesignTokens = await this.llm.inferDesignTokensFromLLM(html, enrichedContext);
            for (const key in llmDesignTokens) {
              if (Array.isArray(designTokens[key]) && Array.isArray(llmDesignTokens[key])) {
                designTokens[key] = Array.from(new Set([...designTokens[key], ...llmDesignTokens[key]]));
              }
              if (key === 'cssVariables' && llmDesignTokens[key] && typeof llmDesignTokens[key] === 'object') {
                designTokens.cssVariables = Object.assign({}, designTokens.cssVariables, llmDesignTokens.cssVariables);
              }
            }
          } catch (e) {
            console.warn('LLM enrichment (design tokens) failed:', e.message);
          }
          try {
            const llmFeatures = await this.llm.extractFeaturesFromLLM(html, structuredData);
            if (Array.isArray(llmFeatures) && llmFeatures.length > 0) {
              structuredData.products = structuredData.products || [];
              const seen = new Set(structuredData.products.map(f => (f.name || '') + '|' + (f.url || '')));
              llmFeatures.forEach(f => {
                const key = (f.name || '') + '|' + (f.url || '');
                if (!seen.has(key)) {
                  structuredData.products.push(f);
                  seen.add(key);
                }
              });
            }
          } catch (e) {
            console.warn('LLM enrichment (features) failed:', e.message);
          }
        }
        const meta = structuredData.meta || {};
        const textContent = await page.evaluate(() => document.body.innerText || "");
        // --- Sanitize designTokens and structuredData for JSON/PG ---
        const safeDesignTokens = sanitizeForJson(designTokens);
        const safeStructuredData = sanitizeForJson(structuredData);
        // Convert screenshot buffer to base64 if present
        let screenshotBase64 = null;
        if (screenshot && Buffer.isBuffer(screenshot)) {
          screenshotBase64 = screenshot.toString('base64');
        } else if (typeof screenshot === 'string') {
          screenshotBase64 = screenshot; // already base64 or url
        }
        // Compose final result and wrap in safeJson
        return safeJson({
          url,
          domain,
          html,
          structuredData: safeStructuredData,
          meta,
          textContent,
          cssVariables: sanitizeForJson(cssVariables),
          computedStyles: sanitizeForJson(mergedStyles),
          designTokens: safeDesignTokens,
          screenshot: screenshotBase64,
          browserUsed: this.browserType,
          captchaDetected: hasCaptcha,
          logoUrl,
          faviconUrl,
          heroImageUrl,
          mode: 'deep'
        });
      } finally {
        await context.close();
      }
    });
  }

  // Main crawl method: choose fast/deep mode
  async crawl(url, options = {}) {
    const mode = (config.crawler && config.crawler.mode) ? config.crawler.mode : 'fast';
    if (mode === 'deep') {
      return await this.crawlDeep(url, options);
    } else {
      return await this.crawlFast(url);
    }
  }

  // Extract major colors from computed styles
  extractMajorColors(computedStyles) {
    if (!computedStyles || !Array.isArray(computedStyles.colors)) return [];
    const colorCounts = {};

    computedStyles.colors.forEach(color => {
      const normalized = color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)/, 'rgb($1, $2, $3)');
      colorCounts[normalized] = (colorCounts[normalized] || 0) + 1;
    });

    return Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([color]) => color);
  }

  extractMajorFonts(computedStyles) {
    if (!computedStyles || !Array.isArray(computedStyles.fonts)) return [];
    const fontCounts = {};
    
    computedStyles.fonts.forEach(font => {
      fontCounts[font] = (fontCounts[font] || 0) + 1;
    });

    return Object.entries(fontCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([font]) => font);
  }

  extractSpacingScale(computedStyles) {
    if (!computedStyles || !Array.isArray(computedStyles.spacing)) return [];
    const spacingSet = new Set();

    computedStyles.spacing.forEach(spacing => {
      const values = spacing.split(' ').map(v => v.trim()).filter(v => v);
      values.forEach(v => { if (v !== '0px') spacingSet.add(v); });
    });

    return Array.from(spacingSet).sort();
  }
}

export default new Crawler();