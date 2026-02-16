// Test if Monaco can initialize with current setup
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('BROWSER:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle0' });
  
  // Wait a bit for React to render
  await page.waitForTimeout(2000);
  
  // Check for errors
  const errors = await page.evaluate(() => {
    return window.__monacoErrors || [];
  });
  
  console.log('Errors found:', errors);
  await browser.close();
})();
