import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import OpenAI from 'https://esm.sh/openai@4.20.1';
import PDFDocument from 'https://esm.sh/pdfkit@0.13.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Simplified PDF Generator
async function generateBrandProfilePDF(kit: any) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    doc.fontSize(24).text(kit.name || 'Brand Profile', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(18).text('Color Palette', { underline: true });
    doc.moveDown();
    // Add more PDF content here based on the kit...
    doc.end();
  });
}

// Simplified LLM call
async function generateSemanticBrandKit(crawlData: any) {
    const prompt = `
    You are a world-class design systems expert. Your task is to analyze the following raw website data and generate a comprehensive, semantic brand kit in a specific JSON format.
    **RAW WEBSITE DATA:**
    - Name: ${crawlData.title}
    - Description: ${crawlData.description}
    - URL: ${crawlData.url}
    - Content Snippet: ${crawlData.raw_html.substring(0, 2000)}
    **TARGET JSON SCHEMA:**
    { "name": "string", "tagline": "string", "colors": { "primary": "string" }, "voice": { "tone": "string" } }`;
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: 'You are a design systems expert.' }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
        throw new Error("No content in LLM response");
    }
    return JSON.parse(content);
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { siteId } = await req.json();
    if (!siteId) {
      return new Response(JSON.stringify({ error: 'siteId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch raw crawl data
    const { data: siteData, error: fetchError } = await supabaseClient
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Perform AI Analysis
    const semanticBrandKit = await generateSemanticBrandKit(siteData);

    // 3. Update database with AI data
    // (Simplified for brevity - update company_info, design_tokens, brand_voice etc.)
    const { error: updateError } = await supabaseClient
        .from('company_info')
        .update({ company_name: semanticBrandKit.name })
        .eq('site_id', siteId);
    if (updateError) throw updateError;


    // 4. Generate PDF
    const pdfBuffer = await generateBrandProfilePDF(semanticBrandKit);

    // 5. Upload PDF to Storage
    const pdfPath = `${siteId}.pdf`;
    const { error: uploadError } = await supabaseClient.storage
      .from('brand-kits')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw uploadError;

    // 6. Get public URL and update site record
    const { data: urlData } = supabaseClient.storage.from('brand-kits').getPublicUrl(pdfPath);
    const pdfKitUrl = urlData.publicUrl;

    // This is a placeholder for updating the site record with the PDF URL
    // await supabaseClient.from('sites').update({ pdf_kit_url: pdfKitUrl, status: 'ready' }).eq('id', siteId);

    return new Response(JSON.stringify({ success: true, pdfKitUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})