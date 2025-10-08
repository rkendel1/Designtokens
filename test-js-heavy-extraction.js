#!/usr/bin/env node

/**
 * Test script to verify enhanced design token extraction for JS-heavy sites
 * 
 * This script tests the crawler against a simple HTML page that simulates
 * various JS-heavy scenarios (dynamic rendering, CSS-in-JS, Tailwind-like utilities)
 */

const crawler = require('./crawler');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Create a test HTML page that simulates JS-heavy scenarios
const testHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JS-Heavy Test Site</title>
  
  <!-- CSS Variables -->
  <style>
    :root {
      --primary-color: #3b82f6;
      --secondary-color: #8b5cf6;
      --spacing-base: 1rem;
      --border-radius-base: 0.5rem;
    }
  </style>
  
  <!-- CSS-in-JS simulation (inline styles) -->
  <style id="styled-components">
    .button-primary {
      background-color: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .card {
      background-color: #ffffff;
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
      margin: 1rem;
    }
    
    .text-gradient {
      background: linear-gradient(to right, #3b82f6, #8b5cf6);
      color: transparent;
      background-clip: text;
      -webkit-background-clip: text;
    }
  </style>
  
  <!-- Tailwind-like utility classes -->
  <style id="tailwind-utilities">
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-purple-500 { background-color: #8b5cf6; }
    .text-white { color: #ffffff; }
    .text-gray-900 { color: #111827; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .m-2 { margin: 0.5rem; }
    .m-4 { margin: 1rem; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .shadow-sm { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
    .shadow-md { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
  </style>
</head>
<body>
  <header>
    <h1 class="text-gradient">JS-Heavy SaaS Site</h1>
  </header>
  
  <main>
    <div class="card">
      <h2>Features</h2>
      <p>This site uses modern web technologies.</p>
      <button class="button-primary">Get Started</button>
    </div>
    
    <div class="bg-blue-500 p-6 rounded-lg shadow-md">
      <p class="text-white">Tailwind-like styling</p>
    </div>
    
    <div class="bg-purple-500 p-4 m-4 rounded shadow-sm">
      <p class="text-white">More utilities</p>
    </div>
  </main>
  
  <script>
    // Simulate dynamic content loading
    setTimeout(() => {
      const dynamicDiv = document.createElement('div');
      dynamicDiv.style.backgroundColor = '#10b981';
      dynamicDiv.style.color = '#ffffff';
      dynamicDiv.style.padding = '1rem';
      dynamicDiv.style.margin = '1rem';
      dynamicDiv.style.borderRadius = '0.5rem';
      dynamicDiv.textContent = 'Dynamically loaded content';
      document.querySelector('main').appendChild(dynamicDiv);
    }, 500);
  </script>
</body>
</html>
`;

async function runTest() {
  console.log('🚀 Starting enhanced design token extraction test...\n');
  
  // Create a simple HTTP server to serve the test page
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(testHTML);
  });
  
  const port = 8765;
  server.listen(port);
  console.log(`📝 Test server started on http://localhost:${port}\n`);
  
  try {
    await crawler.init();
    console.log('✅ Crawler initialized\n');
    
    const url = `http://localhost:${port}`;
    console.log(`🔍 Crawling ${url}...\n`);
    
    const result = await crawler.crawlDeep(url, { takeScreenshot: false });
    
    console.log('📊 Extraction Results:\n');
    console.log('━'.repeat(60));
    
    console.log('\n🎨 COLORS:');
    console.log(`  Found ${result.designTokens.colors.length} unique colors:`);
    result.designTokens.colors.forEach(color => console.log(`    - ${color}`));
    
    console.log('\n🔤 FONTS:');
    console.log(`  Found ${result.designTokens.fonts.length} unique fonts:`);
    result.designTokens.fonts.forEach(font => console.log(`    - ${font}`));
    
    console.log('\n📏 FONT SIZES:');
    console.log(`  Found ${result.designTokens.fontSizes.length} unique font sizes:`);
    result.designTokens.fontSizes.slice(0, 10).forEach(size => console.log(`    - ${size}`));
    if (result.designTokens.fontSizes.length > 10) {
      console.log(`    ... and ${result.designTokens.fontSizes.length - 10} more`);
    }
    
    console.log('\n📐 SPACING:');
    console.log(`  Found ${result.designTokens.spacing.length} unique spacing values:`);
    result.designTokens.spacing.slice(0, 10).forEach(spacing => console.log(`    - ${spacing}`));
    if (result.designTokens.spacing.length > 10) {
      console.log(`    ... and ${result.designTokens.spacing.length - 10} more`);
    }
    
    console.log('\n⭕ BORDER RADIUS:');
    console.log(`  Found ${result.designTokens.borderRadius.length} unique border radius values:`);
    result.designTokens.borderRadius.forEach(radius => console.log(`    - ${radius}`));
    
    console.log('\n🌑 SHADOWS:');
    console.log(`  Found ${result.designTokens.shadows.length} unique shadow values:`);
    result.designTokens.shadows.forEach(shadow => console.log(`    - ${shadow}`));
    
    console.log('\n🎯 CSS VARIABLES:');
    const varCount = Object.keys(result.designTokens.cssVariables).length;
    console.log(`  Found ${varCount} CSS custom properties:`);
    Object.entries(result.designTokens.cssVariables).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });
    
    console.log('\n━'.repeat(60));
    console.log('\n✨ Test completed successfully!\n');
    
    // Verify we got meaningful results
    const hasColors = result.designTokens.colors.length > 0;
    const hasFonts = result.designTokens.fonts.length > 0;
    const hasSpacing = result.designTokens.spacing.length > 0;
    const hasCSSVars = Object.keys(result.designTokens.cssVariables).length > 0;
    
    if (hasColors && hasFonts && hasSpacing && hasCSSVars) {
      console.log('✅ VERIFICATION PASSED: All expected token types were extracted!\n');
    } else {
      console.log('⚠️  VERIFICATION WARNING: Some token types may be missing\n');
      console.log(`   Colors: ${hasColors ? '✅' : '❌'}`);
      console.log(`   Fonts: ${hasFonts ? '✅' : '❌'}`);
      console.log(`   Spacing: ${hasSpacing ? '✅' : '❌'}`);
      console.log(`   CSS Variables: ${hasCSSVars ? '✅' : '❌'}\n`);
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await crawler.close();
    server.close();
    console.log('🛑 Test server stopped\n');
  }
}

// Run the test
runTest().catch(console.error);
