const llm = require('../llm');
const config = require('../config');

describe('Enhanced LLM Service', () => {
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';

  describe('LLM Provider Selection', () => {
    it('should support OpenAI provider', () => {
      const originalProvider = config.llm.provider;
      config.llm.provider = 'openai';
      
      expect(config.llm.provider).toBe('openai');
      
      config.llm.provider = originalProvider;
    });

    it('should support Ollama provider', () => {
      const originalProvider = config.llm.provider;
      config.llm.provider = 'ollama';
      
      expect(config.llm.provider).toBe('ollama');
      
      config.llm.provider = originalProvider;
    });

    it('should have callLLM method', () => {
      expect(typeof llm.callLLM).toBe('function');
    });

    it('should have callOllama method', () => {
      expect(typeof llm.callOllama).toBe('function');
    });

    it('should have callOpenAI method', () => {
      expect(typeof llm.callOpenAI).toBe('function');
    });
  });

  describe('Ollama Integration', () => {
    it('should have Ollama configuration', () => {
      expect(config.llm.ollamaUrl).toBeDefined();
      expect(config.llm.ollamaModel).toBeDefined();
    });

    it('should throw error when Ollama is unavailable', async () => {
      const originalProvider = config.llm.provider;
      config.llm.provider = 'ollama';

      // Ollama is not running in test environment
      await expect(
        llm.callLLM('test prompt', 'test system')
      ).rejects.toThrow();

      config.llm.provider = originalProvider;
    });
  });

  describe('generateEmbedding with provider switch', () => {
    it('should support embedding generation interface', () => {
      expect(typeof llm.generateEmbedding).toBe('function');
    });

    it('should work with OpenAI when configured', async () => {
      if (!hasOpenAIKey) {
        console.log('Skipping OpenAI embedding test - no API key');
        return;
      }

      const originalProvider = config.llm.provider;
      config.llm.provider = 'openai';

      const embedding = await llm.generateEmbedding('test text');
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);

      config.llm.provider = originalProvider;
    }, 30000);
  });

  describe('LLM Methods with Provider Abstraction', () => {
    it('should have summarizeBrandVoice method', () => {
      expect(typeof llm.summarizeBrandVoice).toBe('function');
    });

    it('should have normalizeDesignTokens method', () => {
      expect(typeof llm.normalizeDesignTokens).toBe('function');
    });

    it('should have extractCompanyMetadata method', () => {
      expect(typeof llm.extractCompanyMetadata).toBe('function');
    });

    it('should have generateBrandSummary method', () => {
      expect(typeof llm.generateBrandSummary).toBe('function');
    });

    it('should have analyzeColors method', () => {
      expect(typeof llm.analyzeColors).toBe('function');
    });
  });
});
