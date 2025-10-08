// Note: These tests require OpenAI API key to be set
// For actual testing, consider mocking the OpenAI client

const llm = require('../llm');

describe('LLM Service', () => {
  // Skip tests if no API key is available
  const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';

  describe('generateEmbedding', () => {
    it('should return an array of numbers', async () => {
      if (!hasApiKey) {
        console.log('Skipping LLM test - no API key');
        return;
      }

      const embedding = await llm.generateEmbedding('test text');
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536); // text-embedding-ada-002 dimension
      expect(typeof embedding[0]).toBe('number');
    }, 30000);
  });

  describe('normalizeDesignTokens', () => {
    it('should return normalized tokens structure', async () => {
      if (!hasApiKey) {
        console.log('Skipping LLM test - no API key');
        return;
      }

      const tokens = [
        { tokenKey: '--primary-color', tokenValue: '#FF0000', tokenType: 'color' },
        { tokenKey: 'font-main', tokenValue: 'Arial, sans-serif', tokenType: 'typography' }
      ];

      const normalized = await llm.normalizeDesignTokens(tokens);
      
      expect(Array.isArray(normalized)).toBe(true);
      if (normalized.length > 0) {
        expect(normalized[0]).toHaveProperty('category');
        expect(normalized[0]).toHaveProperty('value');
      }
    }, 30000);
  });

  describe('summarizeBrandVoice', () => {
    it('should return brand voice analysis', async () => {
      if (!hasApiKey) {
        console.log('Skipping LLM test - no API key');
        return;
      }

      const content = 'We are a friendly, innovative company that values customer satisfaction above all else. Our mission is to provide exceptional service.';

      const analysis = await llm.summarizeBrandVoice(content);
      
      expect(typeof analysis).toBe('object');
      // The exact structure may vary, but should have some of these properties
      expect(analysis).toBeDefined();
    }, 30000);
  });

  describe('extractCompanyMetadata', () => {
    it('should return company metadata', async () => {
      if (!hasApiKey) {
        console.log('Skipping LLM test - no API key');
        return;
      }

      const html = '<html><body><h1>Acme Corporation</h1><p>Leading provider of innovative solutions</p></body></html>';
      const extractedData = { emails: ['info@acme.com'], phones: [] };

      const metadata = await llm.extractCompanyMetadata(html, extractedData);
      
      expect(typeof metadata).toBe('object');
      expect(metadata).toHaveProperty('companyName');
    }, 30000);
  });

  describe('analyzeColors', () => {
    it('should categorize colors', async () => {
      if (!hasApiKey) {
        console.log('Skipping LLM test - no API key');
        return;
      }

      const colors = [
        'rgb(255, 0, 0)',
        'rgb(0, 0, 255)',
        'rgb(0, 255, 0)',
        'rgb(128, 128, 128)'
      ];

      const categorized = await llm.analyzeColors(colors);
      
      expect(typeof categorized).toBe('object');
      // Should have some categorization
      expect(categorized).toBeDefined();
    }, 30000);
  });

  describe('generateBrandSummary', () => {
    it('should generate a summary', async () => {
      if (!hasApiKey) {
        console.log('Skipping LLM test - no API key');
        return;
      }

      const siteData = {
        title: 'Acme Corp',
        description: 'Innovative solutions provider',
        content: 'We provide cutting-edge technology solutions to businesses worldwide.',
        companyInfo: { companyName: 'Acme Corporation' }
      };

      const summary = await llm.generateBrandSummary(siteData);
      
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    }, 30000);
  });
});
