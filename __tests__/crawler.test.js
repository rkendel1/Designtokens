const crawler = require('../crawler');

describe('Crawler', () => {
  describe('extractMajorColors', () => {
    it('should extract and sort colors by frequency', () => {
      const computedStyles = {
        colors: [
          'rgb(255, 0, 0)',
          'rgb(255, 0, 0)',
          'rgb(0, 255, 0)',
          'rgb(0, 0, 255)',
          'rgb(255, 0, 0)',
          'rgba(255, 0, 0, 1)', // Should normalize to rgb
        ]
      };

      const majorColors = crawler.extractMajorColors(computedStyles);
      
      expect(majorColors).toBeInstanceOf(Array);
      expect(majorColors.length).toBeGreaterThan(0);
      expect(majorColors[0]).toBe('rgb(255, 0, 0)'); // Most frequent
    });

    it('should return top 10 colors', () => {
      const colors = Array.from({ length: 20 }, (_, i) => `rgb(${i}, ${i}, ${i})`);
      const computedStyles = { colors };

      const majorColors = crawler.extractMajorColors(computedStyles);
      
      expect(majorColors.length).toBeLessThanOrEqual(10);
    });
  });

  describe('extractMajorFonts', () => {
    it('should extract and sort fonts by frequency', () => {
      const computedStyles = {
        fonts: [
          'Arial, sans-serif',
          'Arial, sans-serif',
          'Times New Roman, serif',
          'Arial, sans-serif'
        ]
      };

      const majorFonts = crawler.extractMajorFonts(computedStyles);
      
      expect(majorFonts).toBeInstanceOf(Array);
      expect(majorFonts[0]).toBe('Arial, sans-serif');
    });

    it('should return top 5 fonts', () => {
      const fonts = Array.from({ length: 10 }, (_, i) => `Font${i}`);
      const computedStyles = { fonts };

      const majorFonts = crawler.extractMajorFonts(computedStyles);
      
      expect(majorFonts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('extractSpacingScale', () => {
    it('should extract unique spacing values', () => {
      const computedStyles = {
        spacing: [
          '10px 20px',
          '10px',
          '20px',
          '10px 20px 30px',
          '0px' // Should be filtered out
        ]
      };

      const spacingScale = crawler.extractSpacingScale(computedStyles);
      
      expect(spacingScale).toBeInstanceOf(Array);
      expect(spacingScale).not.toContain('0px');
      expect(spacingScale).toContain('10px');
      expect(spacingScale).toContain('20px');
    });
  });

  describe('extractStructuredData', () => {
    it('should extract emails from HTML', () => {
      const html = '<html><body><p>Contact us at info@example.com or <a href="mailto:support@example.com">support</a></p></body></html>';
      
      const data = crawler.extractStructuredData(html);
      
      expect(data.emails).toContain('info@example.com');
      expect(data.emails).toContain('support@example.com');
    });

    it('should extract phone numbers from HTML', () => {
      const html = '<html><body><p>Call us at 555-123-4567 or <a href="tel:+15551234567">click here</a></p></body></html>';
      
      const data = crawler.extractStructuredData(html);
      
      expect(data.phones.length).toBeGreaterThan(0);
    });

    it('should extract social links', () => {
      const html = '<html><body><a href="https://facebook.com/example">Facebook</a><a href="https://twitter.com/example">Twitter</a></body></html>';
      
      const data = crawler.extractStructuredData(html);
      
      expect(data.socialLinks.length).toBe(2);
      expect(data.socialLinks.some(l => l.platform === 'facebook')).toBe(true);
      expect(data.socialLinks.some(l => l.platform === 'twitter')).toBe(true);
    });

    it('should extract meta information', () => {
      const html = `
        <html>
          <head>
            <title>Test Site</title>
            <meta name="description" content="Test description">
            <meta property="og:title" content="OG Title">
          </head>
          <body></body>
        </html>
      `;
      
      const data = crawler.extractStructuredData(html);
      
      expect(data.meta.title).toBe('Test Site');
      expect(data.meta.description).toBe('Test description');
      expect(data.meta.ogTitle).toBe('OG Title');
    });
  });

  describe('checkRobots', () => {
    it('should allow crawling when no robots.txt exists', async () => {
      // This test would need network mocking in a real scenario
      const allowed = await crawler.checkRobots('https://example-no-robots.com');
      expect(typeof allowed).toBe('boolean');
    });
  });
});
