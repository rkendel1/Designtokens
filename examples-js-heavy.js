#!/usr/bin/env node

/**
 * Example: Enhanced Design Token Extraction for JS-Heavy SaaS Sites
 * 
 * This example demonstrates the new capabilities for extracting design tokens
 * from modern JavaScript-heavy SaaS websites.
 * 
 * New Features Demonstrated:
 * 1. Tailwind class resolution
 * 2. Hidden/interactive element capture
 * 3. Section-level screenshot color extraction
 * 4. Enriched LLM context
 * 5. Complete token merging
 */

const crawler = require('./crawler');

async function demonstrateEnhancements() {
  console.log('🚀 Enhanced Design Token Extraction Demo\n');
  console.log('This demo shows the new capabilities for JS-heavy SaaS sites:\n');
  
  // Initialize the crawler
  await crawler.init();
  
  try {
    // Example 1: Extract from a Tailwind CSS site
    console.log('📝 Example 1: Tailwind CSS Site');
    console.log('URL: https://tailwindcss.com');
    console.log('Features used: Tailwind resolver, section screenshots\n');
    
    const tailwindResult = await crawler.crawlDeep('https://tailwindcss.com', { 
      takeScreenshot: true 
    });
    
    console.log('✅ Extracted Design Tokens:');
    console.log(`   - Colors: ${tailwindResult.designTokens.colors.length} unique values`);
    console.log(`   - Fonts: ${tailwindResult.designTokens.fonts.length} unique values`);
    console.log(`   - Font Sizes: ${tailwindResult.designTokens.fontSizes.length} unique values`);
    console.log(`   - Spacing: ${tailwindResult.designTokens.spacing.length} unique values`);
    console.log(`   - Border Radius: ${tailwindResult.designTokens.borderRadius.length} unique values`);
    console.log(`   - Shadows: ${tailwindResult.designTokens.shadows.length} unique values`);
    console.log(`   - CSS Variables: ${Object.keys(tailwindResult.designTokens.cssVariables).length} properties\n`);
    
    // Show sample colors
    console.log('   Sample Colors:');
    tailwindResult.designTokens.colors.slice(0, 5).forEach(color => {
      console.log(`     • ${color}`);
    });
    console.log('');
    
    // Example 2: Extract from a React/Next.js site with modals
    console.log('📝 Example 2: React/Next.js Site with Interactive Elements');
    console.log('URL: https://vercel.com');
    console.log('Features used: Hidden element capture, LLM enrichment\n');
    
    const reactResult = await crawler.crawlDeep('https://vercel.com', { 
      takeScreenshot: true 
    });
    
    console.log('✅ Extracted Design Tokens:');
    console.log(`   - Colors: ${reactResult.designTokens.colors.length} unique values`);
    console.log(`   - Fonts: ${reactResult.designTokens.fonts.length} unique values`);
    console.log(`   - Spacing: ${reactResult.designTokens.spacing.length} unique values\n`);
    
    // Show sample fonts
    console.log('   Sample Fonts:');
    reactResult.designTokens.fonts.slice(0, 3).forEach(font => {
      console.log(`     • ${font}`);
    });
    console.log('');
    
    // Example 3: Comprehensive extraction from a SaaS landing page
    console.log('📝 Example 3: Comprehensive SaaS Landing Page');
    console.log('URL: https://stripe.com');
    console.log('Features used: All enhancements combined\n');
    
    const saasResult = await crawler.crawlDeep('https://stripe.com', { 
      takeScreenshot: true 
    });
    
    console.log('✅ Complete Design Token Extraction:');
    console.log(`   - Total Colors: ${saasResult.designTokens.colors.length}`);
    console.log(`   - Total Fonts: ${saasResult.designTokens.fonts.length}`);
    console.log(`   - Total Font Sizes: ${saasResult.designTokens.fontSizes.length}`);
    console.log(`   - Total Spacing Values: ${saasResult.designTokens.spacing.length}`);
    console.log(`   - Total Border Radius: ${saasResult.designTokens.borderRadius.length}`);
    console.log(`   - Total Shadows: ${saasResult.designTokens.shadows.length}\n`);
    
    console.log('   Token Sources:');
    console.log('     ✓ Computed styles from all visible elements');
    console.log('     ✓ Stylesheet rules (including Tailwind utilities)');
    console.log('     ✓ Resolved Tailwind class names to CSS values');
    console.log('     ✓ Full-page screenshot dominant colors');
    console.log('     ✓ Section-level screenshot colors');
    console.log('     ✓ Hidden/interactive elements (modals, dropdowns, etc.)');
    console.log('     ✓ LLM-inferred tokens from enriched context\n');
    
    // Show comprehensive spacing scale
    console.log('   Spacing Scale:');
    saasResult.designTokens.spacing.slice(0, 8).forEach(space => {
      console.log(`     • ${space}`);
    });
    console.log('');
    
    console.log('✨ All examples completed successfully!\n');
    console.log('Key Improvements:');
    console.log('  1. ✅ Tailwind classes are resolved to actual CSS values');
    console.log('  2. ✅ Hidden elements (modals, dropdowns) are captured');
    console.log('  3. ✅ Section-level colors provide granular analysis');
    console.log('  4. ✅ LLM receives enriched context for better inference');
    console.log('  5. ✅ All token sources are merged and deduplicated\n');
    
  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up
    await crawler.close();
  }
}

// Run the demo
if (require.main === module) {
  demonstrateEnhancements()
    .then(() => {
      console.log('👋 Demo completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { demonstrateEnhancements };
