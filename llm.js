const OpenAI = require('openai');
const axios = require('axios');
const config = require('./config');

// Initialize OpenAI client only if API key is available
let openai = null;
if (config.openai.apiKey && config.openai.apiKey !== 'your_openai_api_key_here') {
  openai = new OpenAI({
    apiKey: config.openai.apiKey
  });
}

class LLMService {
  // Call Ollama API
  async callOllama(prompt, systemPrompt = '') {
    try {
      const response = await axios.post(`${config.llm.ollamaUrl}/api/generate`, {
        model: config.llm.ollamaModel,
        prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
        stream: false
      });
      
      return response.data.response;
    } catch (error) {
      console.error('Error calling Ollama:', error.message);
      throw new Error('Ollama API error: ' + error.message);
    }
  }

  // Call OpenAI API
  async callOpenAI(prompt, systemPrompt, responseFormat = null) {
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const options = {
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.3
    };

    if (responseFormat) {
      options.response_format = responseFormat;
    }

    const response = await openai.chat.completions.create(options);
    return response.choices[0].message.content;
  }

  // Generic LLM call - switches based on provider
  async callLLM(prompt, systemPrompt = '', responseFormat = null) {
    const provider = config.llm.provider;

    if (provider === 'ollama') {
      const response = await this.callOllama(prompt, systemPrompt);
      // Try to parse JSON if needed
      if (responseFormat?.type === 'json_object') {
        try {
          return JSON.parse(response);
        } catch (e) {
          // If parsing fails, try to extract JSON from response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          throw new Error('Failed to parse JSON response from Ollama');
        }
      }
      return response;
    } else if (provider === 'openai') {
      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await this.callOpenAI(prompt, systemPrompt, responseFormat);
      if (responseFormat?.type === 'json_object') {
        return JSON.parse(response);
      }
      return response;
    } else {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  // Generate embeddings for text
  async generateEmbedding(text) {
    if (config.llm.provider === 'ollama') {
      // Ollama embeddings
      try {
        const response = await axios.post(`${config.llm.ollamaUrl}/api/embeddings`, {
          model: config.llm.ollamaModel,
          prompt: text
        });
        return response.data.embedding;
      } catch (error) {
        console.error('Error generating Ollama embedding:', error);
        throw error;
      }
    } else {
      // OpenAI embeddings
      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }
      
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: text
        });
        return response.data[0].embedding;
      } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
      }
    }
  }

  // Summarize brand voice from content
  async summarizeBrandVoice(content) {
    try {
      const prompt = `Analyze the following website content and provide a comprehensive brand voice analysis. Include:
1. Tone (e.g., professional, friendly, casual, authoritative)
2. Personality traits
3. Voice guidelines and characteristics
4. Key messaging themes

Website content:
${content.substring(0, 4000)}

Provide the analysis in JSON format with keys: tone, personality, guidelines, themes`;

      const systemPrompt = 'You are a brand voice and messaging expert. Analyze website content and extract brand voice characteristics.';

      return await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
    } catch (error) {
      console.error('Error summarizing brand voice:', error);
      throw error;
    }
  }

  // Normalize and categorize design tokens
  async normalizeDesignTokens(tokens) {
    try {
      const prompt = `Analyze and normalize the following design tokens. Categorize them properly and provide standardized names.

Tokens:
${JSON.stringify(tokens, null, 2)}

Return normalized tokens in JSON format as an array with structure:
[{
  "originalKey": "string",
  "normalizedKey": "string",
  "category": "color|typography|spacing|shadow|border|other",
  "value": "string",
  "description": "string"
}]`;

      const systemPrompt = 'You are a design systems expert. Normalize and categorize design tokens following industry best practices.';

      const result = await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
      return result.tokens || [];
    } catch (error) {
      console.error('Error normalizing design tokens:', error);
      throw error;
    }
  }

  // Extract company metadata
  async extractCompanyMetadata(html, extractedData) {
    try {
      const prompt = `Extract and normalize company information from the following data:

HTML snippets: ${html.substring(0, 2000)}

Extracted data: ${JSON.stringify(extractedData)}

Provide canonical company metadata in JSON format:
{
  "companyName": "official company name",
  "legalName": "legal business name if different",
  "description": "brief company description",
  "industry": "primary industry",
  "metadata": {
    "founded": "year if available",
    "headquarters": "location if available"
  }
}`;

      const systemPrompt = 'You are an expert at extracting and normalizing company information from web data.';

      return await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
    } catch (error) {
      console.error('Error extracting company metadata:', error);
      throw error;
    }
  }

  // Generate brand summary
  async generateBrandSummary(siteData) {
    try {
      const { title, description, content, companyInfo } = siteData;
      
      const prompt = `Create a concise brand summary based on the following information:

Title: ${title}
Description: ${description}
Company: ${companyInfo?.companyName || 'Unknown'}
Content sample: ${content?.substring(0, 1000)}

Provide a 2-3 sentence professional brand summary.`;

      const systemPrompt = 'You are a brand strategist creating concise, professional brand summaries.';

      const response = await this.callLLM(prompt, systemPrompt);
      return typeof response === 'string' ? response.trim() : response;
    } catch (error) {
      console.error('Error generating brand summary:', error);
      throw error;
    }
  }

  // Analyze colors and suggest categorization
  async analyzeColors(colors) {
    try {
      const prompt = `Analyze the following colors and categorize them as primary, secondary, accent, neutral, or semantic colors:

Colors: ${JSON.stringify(colors)}

Return JSON with categorized colors:
{
  "primary": ["color values"],
  "secondary": ["color values"],
  "accent": ["color values"],
  "neutral": ["color values"],
  "semantic": {
    "success": "value",
    "warning": "value",
    "error": "value",
    "info": "value"
  }
}`;

      const systemPrompt = 'You are a design systems expert specializing in color theory and design token organization.';

      return await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
    } catch (error) {
      console.error('Error analyzing colors:', error);
      throw error;
    }
  }
}

module.exports = new LLMService();
