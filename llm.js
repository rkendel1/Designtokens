const OpenAI = require('openai');
const axios = require('axios');
const config = require('./config');
const { v4: uuidv4 } = require('uuid');

// Initialize OpenAI client only if API key is available
let openai = null;
if (config.openai.apiKey && config.openai.apiKey.startsWith('sk-')) {
  openai = new OpenAI({
    apiKey: config.openai.apiKey
  });
}

class LLMService {
  // The following LLM-powered methods are used to enrich crawl results for modern JS-heavy SaaS sites.
  // They provide advanced AI-powered extraction and normalization of design tokens and feature detection.
  /**
   * Uses LLM to infer and normalize design tokens from HTML and computed styles.
   * @param {string} html - HTML snippet or content
   * @param {object} computedStyles - Object mapping selectors or elements to computed style objects
   * @returns {Promise<Array>} Structured array of normalized design tokens
   */
  async inferDesignTokensFromLLM(html, computedStyles) {
    try {
      const prompt = `Given the following HTML and computed CSS styles, extract and normalize design tokens.
Focus on tokens for colors, typography (fonts, font sizes, weights), spacing (padding, margin, gaps), shadows, and border radii.
Return a structured array, normalizing similar values and using standard design token naming conventions.

HTML snippet:
${html.substring(0, 3000)}

Computed styles (JSON):
${JSON.stringify(computedStyles, null, 2)}

Output format (JSON array):
[
  {
    "originalKey": "string (e.g. --main-bg-color or .button background)",
    "normalizedKey": "string (e.g. color.background.primary)",
    "category": "color|typography|spacing|shadow|border",
    "value": "string (the CSS value)",
    "description": "string (brief explanation of use)"
  }
]
`;
      const systemPrompt = 'You are a world-class design systems and frontend expert. Extract and normalize design tokens from HTML and computed CSS styles, deduplicating and organizing them using industry best practices.';
      const result = await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
      // Accept array directly or as .tokens property
      if (Array.isArray(result)) {
        return result;
      }
      if (Array.isArray(result.tokens)) {
        return result.tokens;
      }
      return [];
    } catch (error) {
      console.error('Error inferring design tokens from LLM:', error);
      throw error;
    }
  }

  /**
   * Uses LLM to extract SaaS features, modules, or pseudo-products from HTML and structured data.
   * @param {string} html - HTML snippet or content
   * @param {object} structuredData - Existing extracted structured data (e.g. navigation, headings, etc.)
   * @returns {Promise<Array>} Array of features with name, description, and optional link
   */
  async extractFeaturesFromLLM(html, structuredData) {
    try {
      const prompt = `Given the following HTML and structured data, identify SaaS features, modules, or pseudo-products.
For each feature, provide:
- name (short, human-readable)
- description (1-2 sentences)
- optional link (if available in the HTML)

HTML snippet:
${html.substring(0, 3000)}

Structured data (JSON):
${JSON.stringify(structuredData, null, 2)}

Return a JSON array:
[
  {
    "name": "Feature Name",
    "description": "Short description of the feature or module",
    "link": "https://example.com/feature" // optional
  }
]
`;
      const systemPrompt = 'You are a SaaS product expert skilled at analyzing web UIs and structured data to extract a list of features, modules, or pseudo-products with descriptions.';
      const result = await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
      // Accept array directly or as .features property
      if (Array.isArray(result)) {
        return result;
      }
      if (Array.isArray(result.features)) {
        return result.features;
      }
      return [];
    } catch (error) {
      console.error('Error extracting features from LLM:', error);
      throw error;
    }
  }
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
    } catch (error)
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

  async generateSemanticBrandKit(crawlData) {
    try {
      const prompt = `
You are a world-class design systems expert. Your task is to analyze the following raw website data and generate a comprehensive, semantic brand kit in a specific JSON format.

**RAW WEBSITE DATA:**

1.  **Company Info:**
    - Name: ${crawlData.meta.title}
    - Description: ${crawlData.meta.description}
    - URL: ${crawlData.url}

2.  **Raw Design Tokens:**
    - Colors: ${JSON.stringify(crawlData.designTokens.colors.slice(0, 20))}
    - Font Families: ${JSON.stringify(crawlData.designTokens.fonts)}
    - Font Sizes: ${JSON.stringify(crawlData.designTokens.fontSizes)}
    - Spacing: ${JSON.stringify(crawlData.designTokens.spacing)}
    - Border Radius: ${JSON.stringify(crawlData.designTokens.borderRadius)}
    - Shadows: ${JSON.stringify(crawlData.designTokens.shadows)}

3.  **Raw CSS Variables:**
    \`\`\`css
    :root {
      ${Object.entries(crawlData.cssVariables).map(([key, value]) => `${key}: ${value};`).join('\n      ')}
    }
    \`\`\`

4.  **Brand Voice Analysis (Initial):**
    - Content Snippet: ${crawlData.textContent.substring(0, 1500)}

5.  **HTML Snippet (for component analysis):**
    \`\`\`html
    ${crawlData.html.substring(0, 3000)}
    \`\`\`

**YOUR TASK:**

Synthesize all the raw data above into a single, structured JSON object that follows this exact schema. Use your expertise to infer semantic meaning (e.g., which color is 'primary', which font size is 'lg').

**TARGET JSON SCHEMA:**
\`\`\`json
{
  "brandId": "string",
  "url": "string",
  "name": "string",
  "tagline": "string",
  "logo": {
    "url": "string",
    "width": "number",
    "height": "number",
    "alt": "string"
  },
  "colors": {
    "primary": "string",
    "secondary": "string",
    "accent": "string",
    "background": "string",
    "surface": "string",
    "success": "string",
    "warning": "string",
    "error": "string",
    "text": {
      "primary": "string",
      "secondary": "string",
      "muted": "string",
      "onPrimary": "string"
    }
  },
  "typography": {
    "fontFamily": { "heading": "string", "body": "string" },
    "fontWeight": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "fontSize": { "xs": "string", "sm": "string", "base": "string", "lg": "string", "xl": "string", "2xl": "string" },
    "lineHeight": { "tight": 1.25, "normal": 1.5, "relaxed": 1.75 }
  },
  "spacing": { "4": "1rem", "8": "2rem" },
  "radius": { "default": "0.25rem", "lg": "0.5rem", "full": "9999px" },
  "shadows": { "default": "string", "md": "string", "lg": "string" },
  "voice": {
    "tone": "string",
    "personality": "string",
    "keyPhrases": ["string"],
    "writingStyle": { "sentenceLength": "string", "activeVoice": "boolean", "jargonLevel": "string", "ctaStyle": "string" },
    "examples": { "headline": "string", "subheadline": "string", "cta": "string" }
  },
  "components": {
    "button": { "base": "string", "variants": { "primary": "string" }, "sizes": { "md": "string" } },
    "card": { "base": "string" }
  },
  "cssVariables": "string",
  "generatedAt": "string",
  "pdfKitUrl": "string",
  "status": "string"
}
\`\`\`
`;
      const systemPrompt = 'You are a world-class design systems expert. Your task is to analyze raw website data and generate a comprehensive, semantic brand kit in a specific JSON format.';
      return await this.callLLM(prompt, systemPrompt, { type: 'json_object' });
    } catch (error) {
      console.error('Error generating semantic brand kit:', error);
      return null;
    }
  }
}

module.exports = new LLMService();