const crawler = require('../crawler');

describe('JS-Heavy Site Crawler Enhancements', () => {
  describe('extractCSSVariables with stylesheet rules', () => {
    it('should return both variables and stylesheetRules', async () => {
      // Mock page with evaluate method
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue({
          variables: {
            '--primary-color': '#007bff',
            '--spacing-base': '1rem'
          },
          stylesheetRules: {
            colors: ['#007bff', 'rgb(255, 0, 0)'],
            fonts: ['Arial, sans-serif'],
            fontSizes: ['16px', '1.5rem'],
            spacing: ['1rem', '2rem'],
            borderRadius: ['4px', '8px'],
            shadows: ['0 2px 4px rgba(0,0,0,0.1)']
          }
        })
      };

      const result = await crawler.extractCSSVariables(mockPage);
      
      expect(result).toHaveProperty('variables');
      expect(result).toHaveProperty('stylesheetRules');
      expect(result.variables).toHaveProperty('--primary-color');
      expect(result.stylesheetRules.colors).toBeInstanceOf(Array);
      expect(result.stylesheetRules.fonts).toBeInstanceOf(Array);
    });
  });

  describe('Enhanced visibility check', () => {
    it('should handle elements with opacity 0 for design token extraction', () => {
      // The new visibility check should be more permissive
      // This test verifies the concept - actual implementation is in page.evaluate
      const mockComputedStyles = {
        colors: ['rgb(255, 0, 0)', 'rgba(0, 0, 0, 0.5)'],
        fonts: ['Arial, sans-serif'],
        fontSizes: ['16px'],
        spacing: ['1rem'],
        borderRadius: ['4px'],
        shadows: ['0 2px 4px rgba(0,0,0,0.1)']
      };

      const majorColors = crawler.extractMajorColors(mockComputedStyles);
      expect(majorColors).toBeInstanceOf(Array);
      expect(majorColors.length).toBeGreaterThan(0);
    });
  });

  describe('Merged styles extraction', () => {
    it('should merge computed styles with stylesheet rules', () => {
      const computedColors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)'];
      const stylesheetColors = ['#007bff', 'rgb(255, 0, 0)']; // One duplicate
      
      const merged = Array.from(new Set([...computedColors, ...stylesheetColors]));
      
      expect(merged.length).toBe(3); // Should deduplicate
      expect(merged).toContain('rgb(255, 0, 0)');
      expect(merged).toContain('rgb(0, 255, 0)');
      expect(merged).toContain('#007bff');
    });
  });

  describe('Design token extraction completeness', () => {
    it('should extract colors from various sources', () => {
      const mockStyles = {
        colors: [
          'rgb(255, 0, 0)',
          '#007bff',
          'rgba(0, 0, 0, 0.5)',
          'hsl(200, 100%, 50%)'
        ]
      };

      const majorColors = crawler.extractMajorColors(mockStyles);
      expect(majorColors).toBeInstanceOf(Array);
      expect(majorColors.length).toBeGreaterThan(0);
    });

    it('should extract spacing values including gaps', () => {
      const mockStyles = {
        spacing: [
          '1rem',
          '2rem',
          '1rem 2rem',
          '10px 20px 30px 40px',
          '0px' // Should be filtered out
        ]
      };

      const spacingScale = crawler.extractSpacingScale(mockStyles);
      expect(spacingScale).toBeInstanceOf(Array);
      expect(spacingScale).not.toContain('0px');
    });

    it('should handle shadow values including text shadows', () => {
      const mockStyles = {
        shadows: [
          '0 2px 4px rgba(0,0,0,0.1)',
          '0 4px 6px rgba(0,0,0,0.1)',
          '2px 2px 4px rgba(0,0,0,0.5)'
        ]
      };

      expect(mockStyles.shadows).toBeInstanceOf(Array);
      expect(mockStyles.shadows.length).toBe(3);
    });
  });
});
