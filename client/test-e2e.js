import puppeteer from 'puppeteer';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log('1. Navigating to Home...');
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('nav');
    console.log('Home loaded successfully.');

    console.log('2. Navigating to Patient Registration...');
    await page.goto('http://localhost:5173/register');
    await page.waitForSelector('form');
    await page.type('input[placeholder="John Doe"]', 'E2E Patient');
    await page.type('input[type="email"]', 'e2e@test.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Check if toast success happens or error
    await page.waitForFunction(
      () => document.body.innerText.includes('Account created successfully') || document.body.innerText.includes('already exists'),
      { timeout: 5000 }
    ).catch(() => console.log('Registration message not found'));

    console.log('3. Navigating to Patient Login...');
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('form');
    // Clear inputs first
    await page.evaluate(() => {
      document.querySelectorAll('input').forEach(i => i.value = '');
    });
    await page.type('input[type="email"]', 'e2e@test.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('Logged in successfully, current URL:', page.url());

    console.log('4. Navigating to Doctors page...');
    await page.goto('http://localhost:5173/doctors');
    await page.waitForSelector('input[placeholder*="Search"]');
    console.log('Doctors page loaded.');

    console.log('5. Navigating to Profile...');
    await page.goto('http://localhost:5173/profile');
    await page.waitForSelector('h2');
    const profileText = await page.evaluate(() => document.querySelector('h2').innerText);
    console.log('Profile page loaded. Heading:', profileText);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    if (errors.length > 0) {
      console.log('--- Errors Found ---');
      errors.forEach(e => console.log(e));
    } else {
      console.log('No console or page errors found during flow!');
    }
    await browser.close();
  }
}

run();
