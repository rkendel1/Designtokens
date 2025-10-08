const OpenAI = require('openai');
const config = require('./config');

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

class LLMService {
  // Generate embeddings for text
  async generateEmbedding(text) {
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a brand voice and messaging expert. Analyze website content and extract brand voice characteristics.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a design systems expert. Normalize and categorize design tokens following industry best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting and normalizing company information from web data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a brand strategist creating concise, professional brand summaries.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 200
      });

      return response.choices[0].message.content.trim();
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a design systems expert specializing in color theory and design token organization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error analyzing colors:', error);
      throw error;
    }
  }
}

module.exports = new LLMService();
