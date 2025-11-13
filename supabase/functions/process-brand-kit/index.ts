import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import OpenAI from 'https://esm.sh/openai@4.20.1';
// Note: pdfkit is not fully compatible with Deno, so we'll use a simplified text-based placeholder.
// A full implementation would require a Deno-compatible PDF library or a different approach.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Comprehensive LLM prompt for brand kit generation
async function generateSemanticBrandKit(crawlData: any) {
    const prompt = `
    Analyze the raw website data below to generate a comprehensive, semantic brand kit.
    RAW DATA:
    - Name: ${crawlData.title}
    - Description: ${crawlData.description}
    - URL: ${crawlData.url}
    - Content Snippet: ${crawlData.raw_html ? crawlData.raw_html.substring(0, 2000) : ''}
    
    YOUR TASK:
    Return a single JSON object with the following schema. Infer semantic meaning (e.g., which color is 'primary').
    
    TARGET JSON SCHEMA:
    {
      "name": "string",
      "tagline": "string",
      "colors": { "primary": "string", "secondary": "string", "accent": "string", "background": "string", "text": "string" },
      "typography": { "fontFamily": { "heading": "string", "body": "string" } },
      "voice": { "tone": "string", "personality": "string", "keyPhrases": ["string"] },
      "design_tokens": [ { "token_key": "string", "token_type": "string", "token_value": "string" } ]
    }`;
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: 'You are a world-class design systems expert.' }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
        throw new Error("No content in LLM response");
    }
    // Robust JSON parsing
    try {
        return JSON.parse(content);
    } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Failed to parse JSON from LLM response");
    }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { siteId } = await req.json();
    if (!siteId) throw new Error('siteId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch raw crawl data
    const { data: siteData, error: fetchError } = await supabase
      .from('sites')
      .select('title, description, url, raw_html')
      .eq('id', siteId)
      .single();
    if (fetchError) throw fetchError;

    // 2. Perform AI Analysis
    const brandKit = await generateSemanticBrandKit(siteData);

    // 3. Save AI-generated data to respective tables
    // Company Info
    await supabase.from('company_info').update({ company_name: brandKit.name }).eq('site_id', siteId);
    
    // Brand Voice
    await supabase.from('brand_voice').insert({
        site_id: siteId,
        summary: `Tone: ${brandKit.voice.tone}, Personality: ${brandKit.voice.personality}`,
        guidelines: brandKit.voice
    });

    // Design Tokens
    if (brandKit.design_tokens && brandKit.design_tokens.length > 0) {
        const tokensToInsert = brandKit.design_tokens.map((token: any) => ({ ...token, site_id: siteId }));
        await supabase.from('design_tokens').insert(tokensToInsert);
    }

    // 4. Generate a simple text file as a placeholder for the PDF
    const pdfContent = `
Brand Profile for: ${brandKit.name}
URL: ${siteData.url}

--- Color Palette ---
Primary: ${brandKit.colors.primary}
Secondary: ${brandKit.colors.secondary}
Accent: ${brandKit.colors.accent}

--- Brand Voice ---
Tone: ${brandKit.voice.tone}
Personality: ${brandKit.voice.personality}
    `;
    const pdfBuffer = new TextEncoder().encode(pdfContent);

    // 5. Upload PDF to Storage
    const pdfPath = `${siteId}-brand-profile.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('brand-kits')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    // 6. Get public URL and update site record
    const { data: urlData } = supabase.storage.from('brand-kits').getPublicUrl(pdfPath);
    const pdfKitUrl = urlData.publicUrl;

    await supabase
      .from('sites')
      .update({ pdf_kit_url: pdfKitUrl, status: 'ready' })
      .eq('id', siteId);

    return new Response(JSON.stringify({ success: true, pdfKitUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})