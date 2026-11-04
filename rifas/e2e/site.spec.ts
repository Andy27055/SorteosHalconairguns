import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
const settings=parse(readFileSync('backend/.env'));
test('catálogo, identidad de marca y selección accesible en escritorio',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:/PRECISIÓN EN/})).toBeVisible();
  await expect(page.getByRole('img',{name:'Logo Halcón Airguns'})).toBeVisible();
  await expect(page.getByRole('link',{name:/ELEGIR MIS NÚMEROS/}).first()).toBeVisible();
  await page.screenshot({path:'playwright-artifacts/home-desktop.png',fullPage:true});
  await page.getByRole('link',{name:/ELEGIR MIS NÚMEROS/}).first().click();
  await page.getByRole('button',{name:'Número 11',exact:true}).click();await expect(page.getByRole('button',{name:'Número 11',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:/INGRESAR PARA RESERVAR/})).toBeEnabled();
});
test('login administrativo, sesión y navegación del panel',async({page})=>{
  await page.goto('/ingresar');await page.getByLabel('Usuario o email').fill(settings.ADMIN_USERNAME);await page.getByLabel('Contraseña',{exact:true}).fill(settings.ADMIN_PASSWORD);await page.getByRole('button',{name:'INGRESAR',exact:true}).click();
  await expect(page).toHaveURL(/\/compras$/);await page.getByRole('link',{name:'Administración',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ADMINISTRACIÓN',exact:true})).toBeVisible();await page.getByRole('tab',{name:'Rifas',exact:true}).click();await expect(page.getByRole('button',{name:'+ NUEVA RIFA'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'ADMINISTRACIÓN',exact:true})).toBeVisible();
  await page.screenshot({path:'playwright-artifacts/admin-desktop.png',fullPage:true});await page.getByRole('button',{name:'Salir',exact:true}).click();await expect(page.getByRole('link',{name:/Ingresar/})).toBeVisible();
});
test('catálogo y navegación móvil sin desbordes',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:/PRECISIÓN EN/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'playwright-artifacts/home-mobile.png',fullPage:true});await page.getByRole('link',{name:/ELEGIR MIS NÚMEROS/}).first().click();
  await expect(page.getByRole('button',{name:'Número 12',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
