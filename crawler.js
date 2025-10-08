const { chromium, firefox, webkit } = require('playwright');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const axios = require('axios');
const config = require('./config');

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
      await page.evaluate((step, total) => {
        const scrollHeight = document.body.scrollHeight;
        const stepHeight = scrollHeight / total;
        window.scrollTo(0, stepHeight * (step + 1));
      }, i, scrollSteps);
      
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

  // Extract CSS variables from page
  async extractCSSVariables(page) {
    return await page.evaluate(() => {
      const variables = {};
      const sheets = Array.from(document.styleSheets);
      
      sheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => {
            if (rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) {
                  variables[prop] = rule.style.getPropertyValue(prop).trim();
                }
              }
            }
          });
        } catch (e) {
          // CORS or security errors, skip
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
      
      return variables;
    });
  }

  // Extract computed styles from elements
  async extractComputedStyles(page) {
    return await page.evaluate(() => {
      const styles = {
        colors: new Set(),
        fonts: new Set(),
        fontSizes: new Set(),
        spacing: new Set(),
        borderRadius: new Set(),
        shadows: new Set()
      };

      const elements = document.querySelectorAll('*');
      const sampleSize = Math.min(elements.length, 200); // Sample to avoid performance issues
      
      for (let i = 0; i < sampleSize; i++) {
        const el = elements[Math.floor(Math.random() * elements.length)];
        const computed = getComputedStyle(el);
        
        // Colors
        const color = computed.color;
        const bgColor = computed.backgroundColor;
        const borderColor = computed.borderColor;
        if (color && color !== 'rgba(0, 0, 0, 0)') styles.colors.add(color);
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') styles.colors.add(bgColor);
        if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') styles.colors.add(borderColor);
        
        // Typography
        const fontFamily = computed.fontFamily;
        const fontSize = computed.fontSize;
        if (fontFamily) styles.fonts.add(fontFamily);
        if (fontSize) styles.fontSizes.add(fontSize);
        
        // Spacing
        const padding = computed.padding;
        const margin = computed.margin;
        if (padding) styles.spacing.add(padding);
        if (margin) styles.spacing.add(margin);
        
        // Border radius
        const borderRadius = computed.borderRadius;
        if (borderRadius && borderRadius !== '0px') styles.borderRadius.add(borderRadius);
        
        // Shadows
        const boxShadow = computed.boxShadow;
        if (boxShadow && boxShadow !== 'none') styles.shadows.add(boxShadow);
      }
      
      return {
        colors: Array.from(styles.colors),
        fonts: Array.from(styles.fonts),
        fontSizes: Array.from(styles.fontSizes),
        spacing: Array.from(styles.spacing),
        borderRadius: Array.from(styles.borderRadius),
        shadows: Array.from(styles.shadows)
      };
    });
  }

  // Extract structured data using Cheerio
  extractStructuredData(html) {
    const $ = cheerio.load(html);
    const data = {
      emails: new Set(),
      phones: new Set(),
      socialLinks: [],
      products: [],
      addresses: []
    };

    // Email regex
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    // Phone regex (simple, supports various formats)
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

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
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        socialDomains.forEach(domain => {
          if (href.includes(domain)) {
            data.socialLinks.push({ platform: domain.replace('.com', ''), url: href });
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

    // Extract meta information
    const metaData = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || ''
    };

    return {
      ...data,
      emails: Array.from(data.emails),
      phones: Array.from(data.phones),
      meta: metaData
    };
  }

  // Main crawl method
  async crawl(url, options = {}) {
    const { depth = 1, takeScreenshot = true } = options;

    // Check robots.txt
    const allowed = await this.checkRobots(url);
    if (!allowed) {
      throw new Error('Crawling not allowed by robots.txt');
    }

    await this.init();

    // Wrap the crawling logic with retry
    return await this.withRetry(async () => {
      const page = await this.browser.newPage();

      try {
        // Set user agent (rotated if enabled)
        await page.setUserAgent(this.getRandomUserAgent());

        // Navigate to page
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: config.crawler.requestTimeout
        });

        // Wait for page to be fully rendered
        await page.waitForTimeout(2000);

        // Check for CAPTCHA
        const hasCaptcha = await this.detectCaptcha(page);
        if (hasCaptcha) {
          console.warn(`CAPTCHA detected on ${url}`);
          // Could throw error or handle differently based on requirements
        }

        // Handle lazy-loaded content
        await this.handleLazyLoad(page);

        // Get HTML
        const html = await page.content();

        // Extract CSS variables
        const cssVariables = await this.extractCSSVariables(page);

        // Extract computed styles
        const computedStyles = await this.extractComputedStyles(page);

        // Take screenshot
        let screenshot = null;
        if (takeScreenshot) {
          screenshot = await page.screenshot({
            fullPage: true,
            type: 'png'
          });
        }

        // Get URL info
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        // Use Cheerio for structured data extraction
        const structuredData = this.extractStructuredData(html);

        // Get text content for analysis
        const textContent = await page.evaluate(() => {
          return document.body.innerText;
        });

        await page.close();

        return {
          url,
          domain,
          html,
          screenshot,
          cssVariables,
          computedStyles,
          structuredData,
          textContent,
          meta: structuredData.meta,
          browserUsed: this.browserType,
          captchaDetected: hasCaptcha
        };
      } catch (error) {
        await page.close();
        throw error;
      }
    });
  }

  // Extract major colors from computed styles
  extractMajorColors(computedStyles) {
    const colorCounts = {};
    
    computedStyles.colors.forEach(color => {
      // Normalize rgba to rgb if alpha is 1
      const normalized = color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)/, 'rgb($1, $2, $3)');
      colorCounts[normalized] = (colorCounts[normalized] || 0) + 1;
    });

    // Sort by frequency and return top colors
    return Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([color]) => color);
  }

  // Extract major fonts
  extractMajorFonts(computedStyles) {
    const fontCounts = {};
    
    computedStyles.fonts.forEach(font => {
      fontCounts[font] = (fontCounts[font] || 0) + 1;
    });

    return Object.entries(fontCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([font]) => font);
  }

  // Extract spacing scale
  extractSpacingScale(computedStyles) {
    const spacingSet = new Set();
    
    computedStyles.spacing.forEach(spacing => {
      // Parse spacing values
      const values = spacing.split(' ').map(v => v.trim()).filter(v => v);
      values.forEach(v => {
        if (v !== '0px') spacingSet.add(v);
      });
    });

    return Array.from(spacingSet).sort();
  }
}

module.exports = new Crawler();
