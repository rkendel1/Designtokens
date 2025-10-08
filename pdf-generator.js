const PDFDocument = require('pdfkit');

async function generateBrandProfilePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Title
      doc.fontSize(24).text('Brand Profile', { align: 'center' });
      doc.moveDown();

      // Site Information
      doc.fontSize(18).text('Site Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12)
        .text(`URL: ${data.site.url}`)
        .text(`Domain: ${data.site.domain}`)
        .text(`Title: ${data.site.title || 'N/A'}`)
        .text(`Description: ${data.site.description || 'N/A'}`);
      doc.moveDown();

      // Company Information
      if (data.companyInfo) {
        doc.fontSize(18).text('Company Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12)
          .text(`Company Name: ${data.companyInfo.company_name || 'N/A'}`)
          .text(`Legal Name: ${data.companyInfo.legal_name || 'N/A'}`);
        
        if (data.companyInfo.contact_emails && data.companyInfo.contact_emails.length > 0) {
          doc.text(`Emails: ${data.companyInfo.contact_emails.join(', ')}`);
        }
        
        if (data.companyInfo.contact_phones && data.companyInfo.contact_phones.length > 0) {
          doc.text(`Phones: ${data.companyInfo.contact_phones.join(', ')}`);
        }
        
        doc.moveDown();
      }

      // Brand Voice
      if (data.brandVoice) {
        doc.fontSize(18).text('Brand Voice', { underline: true });
        doc.moveDown(0.5);
        
        try {
          const summary = typeof data.brandVoice.summary === 'string' 
            ? JSON.parse(data.brandVoice.summary) 
            : data.brandVoice.summary;
          
          doc.fontSize(12);
          if (summary.tone) {
            doc.text(`Tone: ${summary.tone}`);
          }
          if (summary.personality) {
            doc.text(`Personality: ${summary.personality}`);
          }
          if (summary.themes) {
            doc.text(`Themes: ${Array.isArray(summary.themes) ? summary.themes.join(', ') : JSON.stringify(summary.themes)}`);
          }
        } catch (e) {
          doc.fontSize(12).text('Brand voice analysis available');
        }
        
        doc.moveDown();
      }

      // Design Tokens - Colors
      const colorTokens = data.designTokens?.filter(t => t.token_type === 'color') || [];
      if (colorTokens.length > 0) {
        doc.fontSize(18).text('Brand Colors', { underline: true });
        doc.moveDown(0.5);
        
        colorTokens.slice(0, 10).forEach(token => {
          doc.fontSize(12).text(`${token.token_key}: ${token.token_value}`);
          
          // Try to draw color swatch
          try {
            const colorValue = token.token_value;
            if (colorValue.includes('rgb')) {
              const matches = colorValue.match(/\d+/g);
              if (matches && matches.length >= 3) {
                const x = doc.x;
                const y = doc.y;
                doc.rect(x + 200, y - 12, 30, 12)
                  .fillAndStroke(`rgb(${matches[0]}, ${matches[1]}, ${matches[2]})`, 'black');
                doc.fillColor('black');
              }
            }
          } catch (e) {
            // Skip swatch if error
          }
        });
        
        doc.moveDown();
      }

      // Design Tokens - Typography
      const typographyTokens = data.designTokens?.filter(t => t.token_type === 'typography') || [];
      if (typographyTokens.length > 0) {
        doc.fontSize(18).text('Typography', { underline: true });
        doc.moveDown(0.5);
        
        typographyTokens.slice(0, 8).forEach(token => {
          doc.fontSize(12).text(`${token.token_key}: ${token.token_value}`);
        });
        
        doc.moveDown();
      }

      // Design Tokens - Spacing
      const spacingTokens = data.designTokens?.filter(t => t.token_type === 'spacing') || [];
      if (spacingTokens.length > 0) {
        doc.fontSize(18).text('Spacing Scale', { underline: true });
        doc.moveDown(0.5);
        
        spacingTokens.slice(0, 10).forEach(token => {
          doc.fontSize(12).text(`${token.token_key}: ${token.token_value}`);
        });
        
        doc.moveDown();
      }

      // Products
      if (data.products && data.products.length > 0) {
        doc.addPage();
        doc.fontSize(18).text('Products', { underline: true });
        doc.moveDown(0.5);
        
        data.products.slice(0, 20).forEach(product => {
          doc.fontSize(12)
            .text(`Name: ${product.name}`)
            .text(`Price: ${product.price || 'N/A'}`)
            .text(`URL: ${product.product_url || 'N/A'}`)
            .moveDown(0.5);
        });
      }

      // Footer
      doc.fontSize(10)
        .text(`Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 50, {
          align: 'center'
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = generateBrandProfilePDF;
