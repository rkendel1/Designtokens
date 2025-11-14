import { chromium, firefox, webkit } from 'playwright';
import { Kernel } from '@onkernel/sdk';
import config from './config.js';

/**
 * Browser Manager for efficient browser session pooling and reuse
 * Manages browser instances, contexts, and pages to minimize overhead
 */
class BrowserManager {
  constructor() {
    this.browsers = new Map(); // browserType -> browser instance
    this.contexts = new Map(); // contextId -> context
    this.pages = new Map(); // pageId -> page
    this.kernel = null;
    this.maxBrowsers = config.crawler.maxBrowserInstances || 3;
    this.maxContextsPerBrowser = config.crawler.maxContextsPerBrowser || 5;
    this.sessionTimeout = config.crawler.sessionTimeout || 300000; // 5 minutes
    this.lastActivity = new Map(); // track last activity for cleanup
    this.cleanupInterval = null;
    
    // Initialize OnKernel if configured
    if (config.onkernel.apiKey) {
      try {
        this.kernel = new Kernel({ apiKey: config.onkernel.apiKey });
        console.log('[BrowserManager] OnKernel initialized for browser management');
      } catch (error) {
        console.error('[BrowserManager] Failed to initialize OnKernel:', error);
      }
    }
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get or create a browser instance
   */
  async getBrowser(type = 'chromium', options = {}) {
    // Check if we already have this browser type
    if (this.browsers.has(type)) {
      const browser = this.browsers.get(type);
      if (browser.isConnected()) {
        this.updateActivity(`browser-${type}`);
        return browser;
      } else {
        // Browser disconnected, remove it
        this.browsers.delete(type);
      }
    }
    
    // Check browser limit
    if (this.browsers.size >= this.maxBrowsers) {
      // Close least recently used browser
      await this.closeLRUBrowser();
    }
    
    // Launch new browser
    const browser = await this.launchBrowser(type, options);
    this.browsers.set(type, browser);
    this.updateActivity(`browser-${type}`);
    
    // Set up disconnect handler
    browser.on('disconnected', () => {
      console.log(`[BrowserManager] Browser ${type} disconnected`);
      this.browsers.delete(type);
    });
    
    return browser;
  }

  /**
   * Launch a browser with OnKernel support
   */
  async launchBrowser(type, options = {}) {
    const defaultOptions = {
      headless: config.crawler.headless !== false, // Default to true unless explicitly set to false
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // For Docker environments
        '--disable-gpu', // For headless
        '--disable-web-security', // For CORS issues
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };
    
    // Merge options
    const launchOptions = { ...defaultOptions, ...options };
    
    // Use OnKernel for Chromium if available
    if (this.kernel && type === 'chromium' && config.crawler.useOnKernel !== false) {
      try {
        console.log('[BrowserManager] Launching Chromium via OnKernel...');
        const kernelBrowser = await this.kernel.browsers.create({
          headless: launchOptions.headless,
          viewport: { width: 1920, height: 1080 },
          // OnKernel specific options
          blockAds: true,
          blockTrackers: true,
          cache: true, // Enable caching for better performance
          proxy: config.crawler.proxy || null
        });
        
        const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
        browser.kernelBrowser = kernelBrowser; // Store for cleanup
        browser.isOnKernel = true;
        
        console.log('[BrowserManager] OnKernel browser launched successfully');
        return browser;
      } catch (error) {
        console.error('[BrowserManager] OnKernel launch failed, falling back to local:', error);
        // Fall through to local launch
      }
    }
    
    // Local browser launch
    console.log(`[BrowserManager] Launching ${type} browser locally...`);
    const browserMap = {
      chromium: chromium,
      firefox: firefox,
      webkit: webkit
    };
    
    const browserEngine = browserMap[type] || chromium;
    return await browserEngine.launch(launchOptions);
  }

  /**
   * Get or create a browser context with session reuse
   */
  async getContext(browserType = 'chromium', contextOptions = {}) {
    const contextId = this.generateContextId(browserType, contextOptions);
    
    // Check if we have this context
    if (this.contexts.has(contextId)) {
      const context = this.contexts.get(contextId);
      // Verify context is still valid
      try {
        await context.pages(); // This will throw if context is closed
        this.updateActivity(contextId);
        return { context, contextId, reused: true };
      } catch {
        // Context is closed, remove it
        this.contexts.delete(contextId);
      }
    }
    
    // Get browser
    const browser = await this.getBrowser(browserType);
    
    // Check context limit per browser
    const browserContexts = Array.from(this.contexts.entries())
      .filter(([id]) => id.startsWith(browserType))
      .length;
    
    if (browserContexts >= this.maxContextsPerBrowser) {
      // Close least recently used context for this browser
      await this.closeLRUContext(browserType);
    }
    
    // Create new context with optimized settings
    const defaultContextOptions = {
      ignoreHTTPSErrors: true,
      userAgent: this.getOptimizedUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      // Performance optimizations
      bypassCSP: true,
      javaScriptEnabled: true,
      // Device emulation for better compatibility
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false
    };
    
    const finalOptions = { ...defaultContextOptions, ...contextOptions };
    const context = await browser.newContext(finalOptions);
    
    // Set up route handlers for resource blocking
    await this.setupResourceBlocking(context);
    
    // Store context
    this.contexts.set(contextId, context);
    this.updateActivity(contextId);
    
    return { context, contextId, reused: false };
  }

  /**
   * Get or create a page with optimizations
   */
  async getPage(contextId, pageOptions = {}) {
    const pageId = `${contextId}-page-${Date.now()}`;
    
    const contextData = this.contexts.get(contextId);
    if (!contextData) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    const page = await contextData.newPage();
    
    // Apply page-level optimizations
    await this.optimizePage(page);
    
    // Store page
    this.pages.set(pageId, page);
    this.updateActivity(pageId);
    
    return { page, pageId };
  }

  /**
   * Set up resource blocking for performance
   */
  async setupResourceBlocking(context) {
    const blockedResourceTypes = [
      'image', 'media', 'font', 'other'
    ];
    
    const blockedDomains = [
      'doubleclick.net', 'googletagmanager.com', 'google-analytics.com',
      'facebook.com', 'twitter.com', 'linkedin.com', 'pinterest.com',
      'amazon-adsystem.com', 'googlesyndication.com', 'adnxs.com',
      'adsystem.com', 'advertising.com', 'adzerk.net'
    ];
    
    if (config.crawler.blockResources !== false) {
      await context.route('**/*', (route) => {
        const request = route.request();
        const url = request.url();
        const resourceType = request.resourceType();
        
        // Block by resource type
        if (blockedResourceTypes.includes(resourceType)) {
          return route.abort();
        }
        
        // Block by domain
        if (blockedDomains.some(domain => url.includes(domain))) {
          return route.abort();
        }
        
        // Block specific file extensions
        if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|mp4|webm|mp3|wav)$/i.test(url)) {
          return route.abort();
        }
        
        // Continue with other requests
        return route.continue();
      });
    }
  }

  /**
   * Apply page-level optimizations
   */
  async optimizePage(page) {
    // Disable animations and transitions for faster rendering
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
    
    // Set extra HTTP headers for better compatibility
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    // Enable request interception for additional control
    if (config.crawler.interceptRequests) {
      page.on('request', request => {
        // Log large requests
        const headers = request.headers();
        const contentLength = headers['content-length'];
        if (contentLength && parseInt(contentLength) > 1000000) {
          console.log(`[BrowserManager] Large request detected: ${request.url()} (${contentLength} bytes)`);
        }
      });
    }
    
    // Handle dialog boxes automatically
    page.on('dialog', async dialog => {
      console.log(`[BrowserManager] Auto-dismissing dialog: ${dialog.message()}`);
      await dialog.dismiss();
    });
    
    // Set default timeouts
    page.setDefaultTimeout(config.crawler.pageTimeout || 30000);
    page.setDefaultNavigationTimeout(config.crawler.navigationTimeout || 60000);
  }

  /**
   * Generate a unique context ID based on options
   */
  generateContextId(browserType, options) {
    const optionsHash = this.hashObject(options);
    return `${browserType}-${optionsHash}`;
  }

  /**
   * Simple hash function for objects
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get optimized user agent
   */
  getOptimizedUserAgent() {
    const agents = [
      // Latest Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Latest Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Latest Edge
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    ];
    
    if (config.crawler.rotateUserAgents) {
      return agents[Math.floor(Math.random() * agents.length)];
    }
    
    return agents[0]; // Default to Chrome on Windows
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(id) {
    this.lastActivity.set(id, Date.now());
  }

  /**
   * Close least recently used browser
   */
  async closeLRUBrowser() {
    let oldestTime = Date.now();
    let oldestType = null;
    
    for (const [type] of this.browsers) {
      const activityTime = this.lastActivity.get(`browser-${type}`) || 0;
      if (activityTime < oldestTime) {
        oldestTime = activityTime;
        oldestType = type;
      }
    }
    
    if (oldestType) {
      await this.closeBrowser(oldestType);
    }
  }

  /**
   * Close least recently used context
   */
  async closeLRUContext(browserType) {
    let oldestTime = Date.now();
    let oldestId = null;
    
    for (const [id] of this.contexts) {
      if (id.startsWith(browserType)) {
        const activityTime = this.lastActivity.get(id) || 0;
        if (activityTime < oldestTime) {
          oldestTime = activityTime;
          oldestId = id;
        }
      }
    }
    
    if (oldestId) {
      await this.closeContext(oldestId);
    }
  }

  /**
   * Close a specific browser
   */
  async closeBrowser(type) {
    const browser = this.browsers.get(type);
    if (browser) {
      // Close all contexts for this browser
      for (const [contextId, context] of this.contexts) {
        if (contextId.startsWith(type)) {
          await context.close();
          this.contexts.delete(contextId);
        }
      }
      
      // Handle OnKernel cleanup
      if (browser.kernelBrowser && this.kernel) {
        try {
          await this.kernel.browsers.destroy(browser.kernelBrowser.id);
        } catch (error) {
          console.error('[BrowserManager] Failed to destroy OnKernel browser:', error);
        }
      }
      
      await browser.close();
      this.browsers.delete(type);
      this.lastActivity.delete(`browser-${type}`);
    }
  }

  /**
   * Close a specific context
   */
  async closeContext(contextId) {
    const context = this.contexts.get(contextId);
    if (context) {
      // Close all pages in this context
      for (const [pageId, page] of this.pages) {
        if (pageId.startsWith(contextId)) {
          await page.close();
          this.pages.delete(pageId);
          this.lastActivity.delete(pageId);
        }
      }
      
      await context.close();
      this.contexts.delete(contextId);
      this.lastActivity.delete(contextId);
    }
  }

  /**
   * Close a specific page
   */
  async closePage(pageId) {
    const page = this.pages.get(pageId);
    if (page) {
      await page.close();
      this.pages.delete(pageId);
      this.lastActivity.delete(pageId);
    }
  }

  /**
   * Start cleanup interval to remove inactive sessions
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      
      // Clean up inactive pages
      for (const [pageId] of this.pages) {
        const lastActive = this.lastActivity.get(pageId) || 0;
        if (now - lastActive > this.sessionTimeout) {
          console.log(`[BrowserManager] Cleaning up inactive page: ${pageId}`);
          await this.closePage(pageId);
        }
      }
      
      // Clean up inactive contexts
      for (const [contextId] of this.contexts) {
        const lastActive = this.lastActivity.get(contextId) || 0;
        if (now - lastActive > this.sessionTimeout) {
          console.log(`[BrowserManager] Cleaning up inactive context: ${contextId}`);
          await this.closeContext(contextId);
        }
      }
      
      // Clean up inactive browsers
      for (const [type] of this.browsers) {
        const lastActive = this.lastActivity.get(`browser-${type}`) || 0;
        if (now - lastActive > this.sessionTimeout * 2) { // Browsers have longer timeout
          console.log(`[BrowserManager] Cleaning up inactive browser: ${type}`);
          await this.closeBrowser(type);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Get statistics about current browser pool
   */
  getStats() {
    return {
      browsers: this.browsers.size,
      contexts: this.contexts.size,
      pages: this.pages.size,
      browserTypes: Array.from(this.browsers.keys()),
      onKernelActive: Array.from(this.browsers.values()).some(b => b.isOnKernel)
    };
  }

  /**
   * Shutdown all browsers and cleanup
   */
  async shutdown() {
    console.log('[BrowserManager] Shutting down...');
    
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all pages
    for (const [pageId] of this.pages) {
      await this.closePage(pageId);
    }
    
    // Close all contexts
    for (const [contextId] of this.contexts) {
      await this.closeContext(contextId);
    }
    
    // Close all browsers
    for (const [type] of this.browsers) {
      await this.closeBrowser(type);
    }
    
    console.log('[BrowserManager] Shutdown complete');
  }
}

// Export singleton instance
export default new BrowserManager();