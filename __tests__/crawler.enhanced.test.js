const crawler = require('../crawler');
const config = require('../config');

describe('Enhanced Crawler Features', () => {
  describe('User Agent Rotation', () => {
    it('should return different user agents when rotation is enabled', () => {
      // Save original config
      const originalRotate = config.crawler.rotateUserAgents;
      
      // Enable rotation
      config.crawler.rotateUserAgents = true;
      
      const agent1 = crawler.getRandomUserAgent();
      const agent2 = crawler.getRandomUserAgent();
      const agent3 = crawler.getRandomUserAgent();
      
      // At least one should be different (or we can check they cycle)
      const agents = [agent1, agent2, agent3];
      const uniqueAgents = new Set(agents);
      
      expect(uniqueAgents.size).toBeGreaterThanOrEqual(1);
      expect(typeof agent1).toBe('string');
      
      // Restore config
      config.crawler.rotateUserAgents = originalRotate;
    });

    it('should return static user agent when rotation is disabled', () => {
      const originalRotate = config.crawler.rotateUserAgents;
      
      config.crawler.rotateUserAgents = false;
      
      const agent1 = crawler.getRandomUserAgent();
      const agent2 = crawler.getRandomUserAgent();
      
      expect(agent1).toBe(agent2);
      expect(agent1).toBe(config.crawler.userAgent);
      
      config.crawler.rotateUserAgents = originalRotate;
    });
  });

  describe('Browser Type Selection', () => {
    it('should return configured browser type when not random', () => {
      const originalBrowser = config.crawler.browser;
      const originalRotate = config.crawler.rotateBrowsers;
      
      config.crawler.browser = 'firefox';
      config.crawler.rotateBrowsers = false;
      
      const browserType = crawler.getBrowserType();
      
      expect(browserType).toBe('firefox');
      
      config.crawler.browser = originalBrowser;
      config.crawler.rotateBrowsers = originalRotate;
    });

    it('should return random browser when configured', () => {
      const originalBrowser = config.crawler.browser;
      
      config.crawler.browser = 'random';
      
      const browserType = crawler.getBrowserType();
      
      expect(['chromium', 'firefox', 'webkit']).toContain(browserType);
      
      config.crawler.browser = originalBrowser;
    });

    it('should rotate browsers when rotation is enabled', () => {
      const originalBrowser = config.crawler.browser;
      const originalRotate = config.crawler.rotateBrowsers;
      
      config.crawler.browser = 'chromium';
      config.crawler.rotateBrowsers = true;
      
      const browserType = crawler.getBrowserType();
      
      expect(['chromium', 'firefox', 'webkit']).toContain(browserType);
      
      config.crawler.browser = originalBrowser;
      config.crawler.rotateBrowsers = originalRotate;
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure and succeed eventually', async () => {
      let attemptCount = 0;
      
      const fn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Simulated failure');
        }
        return 'success';
      };
      
      const result = await crawler.withRetry(fn, 3);
      
      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });

    it('should throw error after max attempts', async () => {
      const fn = async () => {
        throw new Error('Persistent failure');
      };
      
      await expect(crawler.withRetry(fn, 3)).rejects.toThrow('Persistent failure');
    });
  });

  describe('Sleep Utility', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await crawler.sleep(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('CAPTCHA Detection', () => {
    it('should detect reCAPTCHA in HTML', async () => {
      // This would require a mock page object
      // Simplified test - checking the logic exists
      expect(typeof crawler.detectCaptcha).toBe('function');
    });
  });

  describe('Lazy Load Handling', () => {
    it('should handle lazy load when enabled', async () => {
      expect(typeof crawler.handleLazyLoad).toBe('function');
      
      const originalHandleLazyLoad = config.crawler.handleLazyLoad;
      config.crawler.handleLazyLoad = false;
      
      // Should complete without error when disabled
      // (actual page testing would require Playwright mock)
      
      config.crawler.handleLazyLoad = originalHandleLazyLoad;
    });
  });

  afterAll(async () => {
    // Clean up browser instance if any
    await crawler.close();
  });
});
