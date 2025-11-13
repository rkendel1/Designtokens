/// <reference types="https://esm.sh/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

async function generateSemanticBrandKit(siteData: any, companyInfo: any, designTokens: any[], brandVoice: any, siteId: string) {
    const prompt = `
    You are a world-class design systems expert. Your task is to analyze the following pre-processed website data and synthesize it into a comprehensive, semantic brand kit in a specific JSON format.

    **PRE-PROCESSED WEBSITE DATA:**
    1.  **Site ID:** ${siteId}
    2.  **Company Info:** ${JSON.stringify(companyInfo)}
    3.  **Extracted Design Tokens (sample):** ${JSON.stringify(designTokens.slice(0, 50))}
    4.  **Initial Brand Voice Analysis:** ${JSON.stringify(brandVoice)}
    5.  **Full Page HTML (for context):**
        \`\`\`html
        ${siteData.raw_html ? siteData.raw_html.substring(0, 6000) : ''}
        \`\`\`

    **YOUR TASK:**
    Synthesize all the pre-processed data above into a single, structured JSON object that follows the exact schema provided. Your main job is to infer semantic meaning (e.g., which of the provided colors is 'primary', which font size is 'lg', what are the button styles) from the raw tokens and HTML.

    **IMPORTANT RULES:**
    - The \`brandId\` field MUST be the Site ID provided.
    - Use the logo URL from the company info.
    - All color values MUST be in a web-safe format like HEX ("#RRGGBB") or RGB ("rgb(r, g, b)").

    **TARGET JSON SCHEMA:**
    \`\`\`json
    {
      "brandId": "${siteId}",
      "url": "${siteData.url}",
      "name": "string",
      "tagline": "string",
      "logo": { "url": "string", "width": "number", "height": "number", "alt": "string" },
      "colors": {
        "primary": "string", "secondary": "string", "accent": "string", "background": "string", "surface": "string",
        "success": "string", "warning": "string", "error": "string",
        "text": { "primary": "string", "secondary": "string", "muted": "string", "onPrimary": "string" }
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
        "tone": "string", "personality": "string", "keyPhrases": ["string"],
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
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: 'You are a design systems expert specializing in synthesizing pre-analyzed data into a semantic brand kit.' }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content in LLM response");
    try {
        return JSON.parse(content);
    } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Failed to parse JSON from LLM response");
    }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { siteId } = await req.json();
    if (!siteId) throw new Error('siteId is required');

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // --- GATHER ALL INCREMENTAL DATA ---
    const { data: siteData, error: siteError } = await supabase.from('sites').select('*').eq('id', siteId).single();
    if (siteError) throw siteError;

    const { data: companyInfo, error: companyError } = await supabase.from('company_info').select('*').eq('site_id', siteId).single();
    if (companyError) throw companyError;

    const { data: designTokens, error: tokensError } = await supabase.from('design_tokens').select('*').eq('site_id', siteId);
    if (tokensError) throw tokensError;

    const { data: brandVoice, error: voiceError } = await supabase.from('brand_voice').select('*').eq('site_id', siteId).single();
    if (voiceError) throw voiceError;

    // --- SYNTHESIZE INTO BRAND KIT ---
    const brandKit = await generateSemanticBrandKit(siteData, companyInfo, designTokens || [], brandVoice, siteId);

    // --- SAVE FINAL ARTIFACTS ---
    await supabase.from('brand_kits').insert({
      site_id: siteId,
      kit_data: brandKit,
      pdf_url: '', // Placeholder, will be updated if PDF is generated
    });

    await supabase.from('sites').update({ status: 'ready' }).eq('id', siteId);

    return new Response(JSON.stringify({ success: true, message: "Brand kit synthesized." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
})