// Verificación visual headless de la UI (Playwright)
// Carga páginas clave en localhost:9001 con el usuario dev CEO y reporta el DOM renderizado.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:9001';
const OUT = '/tmp/ui-verify';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'smartmailbox', url: '/smartmailbox' },
  { name: 'documentarchive', url: '/documentarchive' },
  { name: 'invoices', url: '/invoices' },
  { name: 'providers', url: '/providers' },
  { name: 'ceobrain', url: '/ceobrain' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

for (const p of PAGES) {
  consoleErrors.length = 0;
  let status = 'ok';
  try {
    await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    status = 'nav-timeout: ' + e.message;
  }
  // Esperar a que React pinte y carguen datos
  await page.waitForTimeout(3500);

  const text = (await page.evaluate(() => document.body.innerText || '')).replace(/\n{2,}/g, '\n').trim();
  const denied = /Acceso Restringido|Acceso Denegado|Redirigiendo al login|Verificando acceso/i.test(text);
  await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: false });

  console.log('\n=== ' + p.name + ' (' + p.url + ') ===');
  console.log('status:', status);
  console.log('denied/blocked:', denied);
  console.log('innerText[0..900]:\n' + text.slice(0, 900));
  if (consoleErrors.length) console.log('consoleErrors:', consoleErrors.slice(0, 5).join(' | '));
}

await browser.close();
console.log('\nScreenshots en ' + OUT);
