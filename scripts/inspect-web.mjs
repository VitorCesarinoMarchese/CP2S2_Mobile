import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await fs.mkdir('docs/screenshots', { recursive: true });
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['phone-web', { width: 390, height: 844 }],
]) {
  await page.setViewportSize(viewport);
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Criar minha conta' }).waitFor();
  await page.screenshot({ path: `docs/screenshots/login-${name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByLabel('Nome', { exact: true }).waitFor();
  await page.screenshot({ path: `docs/screenshots/register-${name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) errors.push(`${name}: horizontal overflow`);
}
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
console.info(
  'Login/cadastro em desktop e viewport de celular: sem erro de execução ou overflow horizontal.',
);
