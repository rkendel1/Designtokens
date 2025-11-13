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

function parseRgb(rgbString: string) {
    if (!rgbString || !rgbString.includes('rgb')) return { r: 0, g: 0, b: 0 };
    const [r, g, b] = rgbString.match(/\d+/g)!.map(Number);
    return { r: r / 255, g: g / 255, b: b / 255 };
}

async function generateBrandProfilePDF(kit: any, siteUrl: string, logoBytes: Uint8Array | null) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPos = height - 70;

    // Embed Logo if available
    if (logoBytes) {
        try {
            const logoImage = await pdfDoc.embedPng(logoBytes);
            const logoDims = logoImage.scale(0.25); // Scale to 25%
            page.drawImage(logoImage, {
                x: width - logoDims.width - 50,
                y: height - logoDims.height - 40,
                width: logoDims.width,
                height: logoDims.height,
            });
        } catch (e) {
            console.error("Failed to embed logo:", e.message);
        }
    }

    page.drawText(kit.name || 'Brand Profile', { x: 50, y: yPos, font: boldFont, size: 24 });
    yPos -= 30;
    page.drawText(siteUrl, { x: 50, y: yPos, font, size: 12, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 40;

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

    page.drawText('Brand Voice', { x: 50, y: yPos, font: boldFont, size: 18 });
    yPos -= 30;
    const voice = kit.voice || {};
    page.drawText(`Tone: ${voice.tone || 'N/A'}`, { x: 50, y: yPos, font, size: 12 });
    yPos -= 20;
    page.drawText(`Personality: ${voice.personality || 'N/A'}`, { x: 50, y: yPos, font, size: 12 });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generateSemanticBrandKit(crawlData: any, companyInfo: any, siteId: string) {
    const prompt = `
    You are a world-class design systems expert. Your task is to analyze the following raw website data and generate a comprehensive, semantic brand kit in a specific JSON format.

    **RAW WEBSITE DATA:**
    1.  **Site ID:** ${siteId}
    2.  **Company Info:**
        - Name: ${crawlData.title}
        - Description: ${crawlData.description}
        - URL: ${crawlData.url}
        - Logo URL: ${companyInfo.logo_url || 'Not found'}
    3.  **Full Page HTML (for Token and Component Analysis):**
        \`\`\`html
        ${crawlData.raw_html ? crawlData.raw_html.substring(0, 8000) : ''}
        \`\`\`

    **YOUR TASK:**
    Synthesize all the raw data above into a single, structured JSON object that follows this exact schema. Use your expertise to infer semantic meaning (e.g., which color is 'primary', which font size is 'lg', what the button styles are).

    **IMPORTANT RULES:**
    - The \`brandId\` field in the output MUST be the Site ID provided in the raw data.
    - If a "Logo URL" is provided, use it for the "logo.url" field. If it is "Not found", leave "logo.url" as an empty string.
    - All color values MUST be in a web-safe format like HEX ("#RRGGBB") or RGB ("rgb(r, g, b)"). Do NOT use modern color functions.
    - Fill in all fields of the schema as completely as possible based on the provided HTML.

    **TARGET JSON SCHEMA:**
    \`\`\`json
    {
      "brandId": "${siteId}",
      "url": "${crawlData.url}",
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
        messages: [{ role: 'system', content: 'You are a design systems expert.' }, { role: 'user', content: prompt }],
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

function transformBrandKitToDesignTokens(kit: any, siteId: string): any[] {
    const tokens: any[] = [];

    // Colors
    if (kit.colors) {
        for (const [key, value] of Object.entries(kit.colors)) {
            if (typeof value === 'string') {
                tokens.push({ site_id: siteId, token_key: `color.${key}`, token_type: 'color', token_value: value, source: 'llm-generated' });
            } else if (typeof value === 'object' && value !== null) { // For colors.text
                for (const [subKey, subValue] of Object.entries(value)) {
                    if (typeof subValue === 'string') {
                        tokens.push({ site_id: siteId, token_key: `color.${key}.${subKey}`, token_type: 'color', token_value: subValue, source: 'llm-generated' });
                    }
                }
            }
        }
    }

    // Typography
    if (kit.typography) {
        if (kit.typography.fontFamily) {
            for (const [key, value] of Object.entries(kit.typography.fontFamily)) {
                if (typeof value === 'string') {
                    tokens.push({ site_id: siteId, token_key: `fontFamily.${key}`, token_type: 'fontFamily', token_value: value, source: 'llm-generated' });
                }
            }
        }
        if (kit.typography.fontSize) {
            for (const [key, value] of Object.entries(kit.typography.fontSize)) {
                if (typeof value === 'string') {
                    tokens.push({ site_id: siteId, token_key: `fontSize.${key}`, token_type: 'fontSize', token_value: value, source: 'llm-generated' });
                }
            }
        }
    }

    // Spacing, Radius, Shadows
    const simpleCategories = { spacing: 'spacing', radius: 'radius', shadows: 'shadow' };
    for (const [category, tokenType] of Object.entries(simpleCategories)) {
        if (kit[category]) {
            for (const [key, value] of Object.entries(kit[category])) {
                if (typeof value === 'string') {
                    tokens.push({ site_id: siteId, token_key: `${category}.${key}`, token_type: tokenType, token_value: value, source: 'llm-generated' });
                }
            }
        }
    }

    return tokens;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { siteId } = await req.json();
    if (!siteId) throw new Error('siteId is required');

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: siteData, error: fetchError } = await supabase.from('sites').select('title, description, url, raw_html').eq('id', siteId).single();
    if (fetchError) throw fetchError;

    const { data: companyInfo, error: companyError } = await supabase.from('company_info').select('logo_url').eq('site_id', siteId).single();
    if (companyError) throw companyError;

    const brandKit = await generateSemanticBrandKit(siteData, companyInfo, siteId);

    let logoBytes: Uint8Array | null = null;
    if (companyInfo.logo_url) {
        const response = await fetch(companyInfo.logo_url);
        if (response.ok) {
            logoBytes = new Uint8Array(await response.arrayBuffer());
            const logoPath = `${siteId}-logo.png`;
            await supabase.storage.from('logos').upload(logoPath, logoBytes, { contentType: 'image/png', upsert: true });
            const { data: logoUrlData } = supabase.storage.from('logos').getPublicUrl(logoPath);
            await supabase.from('company_info').update({ logo_url: logoUrlData.publicUrl }).eq('site_id', siteId);
        }
    }

    await supabase.from('company_info').update({ company_name: brandKit.name }).eq('site_id', siteId);
    await supabase.from('brand_voice').insert({ site_id: siteId, summary: `Tone: ${brandKit.voice.tone}`, guidelines: brandKit.voice });
    
    // Transform and insert design tokens
    const designTokens = transformBrandKitToDesignTokens(brandKit, siteId);
    if (designTokens.length > 0) {
        const { error: tokenError } = await supabase.from('design_tokens').insert(designTokens);
        if (tokenError) {
            console.error('Error inserting design tokens:', tokenError);
        }
    }

    const pdfBuffer = await generateBrandProfilePDF(brandKit, siteData.url, logoBytes);
    const pdfPath = `${siteId}-brand-profile.pdf`;
    await supabase.storage.from('brand-kits').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    const { data: urlData } = supabase.storage.from('brand-kits').getPublicUrl(pdfPath);
    
    await supabase.from('brand_kits').insert({
      site_id: siteId,
      kit_data: brandKit,
      pdf_url: urlData.publicUrl,
    });

    await supabase.from('sites').update({ pdf_kit_url: urlData.publicUrl, status: 'ready' }).eq('id', siteId);

    return new Response(JSON.stringify({ success: true, pdfKitUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
})