import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Explicit opt-in: uses the current protected demo and an existing developer account.
test.skip(process.env.DEMO_SMOKE !== '1', 'Sólo para la demostración local activa.');
for (const width of [390, 320]) {
  test(`acceso privado e inicio de sesión real a ${width}px`, async ({ page }) => {
    const { url, protection } = JSON.parse(readFileSync('.demo/session.json', 'utf8'));
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${url}/ingresar`);
    const anonymous = await page.request.get(`${url}/api/admin/users`);
    expect(anonymous.status()).toBe(401);
    if (protection === 'private-code-gate') {
      const code = readFileSync('.demo/acceso.txt', 'utf8').trim();
      await expect(page.getByRole('heading', { name: 'HALCÓN AIRGUNS' })).toBeVisible();
      expect((await anonymous.json()).code).toBe('DEMO_ACCESS_REQUIRED');
      await page.getByLabel('Clave de la demostración').fill(code);
      await page.getByRole('button', { name: 'ENTRAR A LA DEMOSTRACIÓN' }).click();
      await page.waitForURL(url + '/');
      await page.goto(`${url}/ingresar`);
    } else {
      await expect(page.getByLabel('Clave de la demostración')).toHaveCount(0);
      for (const path of ['/api/orders', '/api/profile', '/api/receipts/private', '/api/admin/raffles']) {
        expect((await page.request.get(url + path)).status()).toBe(401);
      }
    }
    const password = page.getByLabel('Contraseña', { exact: true });
    await password.fill('admin');
    await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('admin');
    await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'password');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `playwright-artifacts/ingreso-contraseña-${width}.png`, animations: 'disabled' });
    await page.getByLabel('Usuario o email').fill('halconairguns@gmail.com');
    const login = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /^INGRESAR/ }).click();
    expect((await login).status()).toBe(200);
    await page.waitForURL(url + '/');
    await page.goto(`${url}/admin`);
    await expect(page.getByRole('tab', { name: 'Rifas', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Rifas', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cookies = await page.context().cookies(`${url}/api/auth/me`);
    if (protection === 'private-code-gate') expect(cookies.find(cookie => cookie.name === 'halcon_demo')).toMatchObject({ secure: true, httpOnly: true });
    expect(cookies.find(cookie => cookie.name === 'halcon_token')).toMatchObject({ secure: true, httpOnly: true });
  });
}
