import PDFDocument from 'pdfkit';

async function generateBrandProfilePDF(kit) {
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
      doc.fontSize(24).text(kit.name || 'Brand Profile', { align: 'center' });
      if (kit.tagline) {
        doc.fontSize(14).fillColor('gray').text(kit.tagline, { align: 'center' });
      }
      doc.moveDown(2);

      // --- Colors Section ---
      doc.fontSize(18).fillColor('black').text('Color Palette', { underline: true });
      doc.moveDown();

      const colors = kit.colors || {};
      let yPos = doc.y;
      let xPos = doc.x;
      const swatchSize = 20;
      const itemsPerRow = 4;
      let itemCount = 0;

      for (const [name, value] of Object.entries(colors)) {
        if (typeof value === 'string') {
          doc.fontSize(10).text(name, xPos, yPos);
          try {
            doc.rect(xPos, yPos + 15, swatchSize, swatchSize).fill(value);
          } catch (e) {
            // Ignore invalid colors
          }
          doc.fontSize(8).fillColor('gray').text(value, xPos, yPos + 15 + swatchSize + 5);

          xPos += swatchSize + 60;
          itemCount++;
          if (itemCount % itemsPerRow === 0) {
            xPos = doc.x;
            yPos += swatchSize + 40;
          }
        }
      }
      doc.y = yPos + swatchSize + 60;
      doc.moveDown();

      // --- Typography Section ---
      doc.fontSize(18).fillColor('black').text('Typography', { underline: true });
      doc.moveDown();
      const typo = kit.typography || {};
      if (typo.fontFamily) {
        doc.fontSize(12).text('Heading Font:', { continued: true }).font(typo.fontFamily.heading || 'Helvetica-Bold').text(typo.fontFamily.heading || 'Not specified');
        doc.font('Helvetica').text('Body Font:', { continued: true }).font(typo.fontFamily.body || 'Helvetica').text(typo.fontFamily.body || 'Not specified');
        doc.moveDown();
      }
      if (typo.fontSize) {
        doc.fontSize(12).font('Helvetica').text('Font Size Scale:');
        for (const [name, size] of Object.entries(typo.fontSize)) {
          doc.fontSize(10).text(`  - ${name}: ${size}`);
        }
      }
      doc.moveDown();

      // --- Brand Voice Section ---
      const voice = kit.voice || {};
      if (voice.tone || voice.personality) {
        doc.addPage();
        doc.fontSize(18).text('Brand Voice', { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Tone: ${voice.tone || 'N/A'}`);
        doc.text(`Personality: ${voice.personality || 'N/A'}`);
        if (voice.examples) {
          doc.moveDown();
          doc.fontSize(12).text('Examples:', { underline: true });
          doc.fontSize(10).text(`Headline: "${voice.examples.headline || ''}"`);
          doc.text(`CTA: "${voice.examples.cta || ''}"`);
        }
      }

      // Footer
      doc.fontSize(10)
        .text(`Generated for ${kit.url} on ${new Date().toLocaleString()}`, 50, doc.page.height - 50, {
          align: 'center'
        });

      doc.end();
    } catch (error) {
      console.error('PDF Generation Error:', error);
      reject(error);
    }
  });
}

export default generateBrandProfilePDF;