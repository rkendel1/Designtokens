import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Helper to parse RGB color strings
function parseRgb(rgbString: string) {
    if (!rgbString || !rgbString.includes('rgb')) return { r: 0, g: 0, b: 0 };
    const [r, g, b] = rgbString.match(/\d+/g)!.map(Number);
    return { r: r / 255, g: g / 255, b: b / 255 };
}

// PDF Generator using pdf-lib
async function generateBrandProfilePDF(kit: any, siteUrl: string) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPos = height - 70;

    // Title
    page.drawText(kit.name || 'Brand Profile', { x: 50, y: yPos, font: boldFont, size: 24 });
    yPos -= 30;
    page.drawText(siteUrl, { x: 50, y: yPos, font, size: 12, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 40;

    // Colors
    page.drawText('Color Palette', { x: 50, y: yPos, font: boldFont, size: 18 });
    yPos -= 30;
    
    const colors = kit.colors || {};
    for (const [name, value] of Object.entries(colors)) {
        if (typeof value === 'string') {
            const color = parseRgb(value);
            page.drawRectangle({ x: 50, y: yPos, width: 20, height: 20, color: rgb(color.r, color.g, color.b) });
            page.drawText(`${name}: ${value}`, { x: 80, y: yPos + 5, font, size: 12 });
            yPos -= 30;
        }
    }
    yPos -= 20;

    // Brand Voice
    page.drawText('Brand Voice', { x: 50, y: yPos, font: boldFont, size: 18 });
    yPos -= 30;
    const voice = kit.voice || {};
    page.drawText(`Tone: ${voice.tone || 'N/A'}`, { x: 50, y: yPos, font, size: 12 });
    yPos -= 20;
    page.drawText(`Personality: ${voice.personality || 'N/A'}`, { x: 50, y: yPos, font, size: 12 });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes; // Returns a Uint8Array
}


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
    await supabase.from('company_info').update({ company_name: brandKit.name }).eq('site_id', siteId);
    await supabase.from('brand_voice').insert({
        site_id: siteId,
        summary: `Tone: ${brandKit.voice.tone}, Personality: ${brandKit.voice.personality}`,
        guidelines: brandKit.voice
    });
    if (brandKit.design_tokens && brandKit.design_tokens.length > 0) {
        const tokensToInsert = brandKit.design_tokens.map((token: any) => ({ ...token, site_id: siteId }));
        await supabase.from('design_tokens').insert(tokensToInsert);
    }

    // 4. Generate PDF
    const pdfBuffer = await generateBrandProfilePDF(brandKit, siteData.url);

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