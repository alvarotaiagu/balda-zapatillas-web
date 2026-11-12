/* Verificación de Balda (Playwright: un solo navegador SIN WebGL, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs          (puerto 8941; todo)
        node verificar.mjs 2 3      (solo esos bloques)
   El 3D no se prueba aquí (WEBS NEGOCIOS/CLAUDE.md): el navegador va con --disable-3d-apis,
   así que la página entra siempre por el plan B. Del 3D solo se mira que el lienzo existe,
   que escena.js es JavaScript válido y que el CDN responde. La escena la mira Álvaro. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8941;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };

const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const leerTexto = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/* ---------- 1. Ficheros, noindex, contraste y 3D sin navegador ---------- */
if (toca(1)) {
  console.log('\n1. Ficheros y reglas sin navegador');
  for (const f of ['index.html', 'legal.html', '404.html']) {
    const h = leerTexto(f);
    comprobar(/^<!doctype html>\s*<html[^>]*>\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/i.test(h), `${f}: noindex justo detrás del charset`);
  }
  const datos = leerTexto('js/datos.js');
  const slugs = [...datos.matchAll(/\{ slug: '([\w-]+)', marca/g)].map((m) => m[1]);
  comprobar(slugs.length === 10, 'datos.js: diez productos', slugs.length);
  const medidas = JSON.parse(leerTexto('modelos/medidas.json'));
  for (const s of slugs) {
    const a = path.join(RAIZ, 'modelos', `${s}-pared.glb`), b = path.join(RAIZ, 'modelos', `${s}.glb`);
    const ok = fs.existsSync(a) && fs.existsSync(b) && medidas[s]?.alto > 0.05;
    comprobar(ok, `modelos de ${s}: pared, zoom y medidas`);
  }
  const pared = slugs.reduce((t, s) => t + fs.statSync(path.join(RAIZ, 'modelos', `${s}-pared.glb`)).size, 0);
  comprobar(pared < 6e6, `los diez de pared pesan menos de 6 MB (${(pared / 1e6).toFixed(1)} MB)`);
  const creditos = leerTexto('CREDITOS.md');
  const uids = [...datos.matchAll(/uid: '([0-9a-f]{32})'/g)].map((m) => m[1]);
  comprobar(uids.length === 10 && uids.every((u) => creditos.includes(`https://sketchfab.com/3d-models/${u}`)), 'cada modelo tiene su crédito con enlace en CREDITOS.md');
  comprobar(fs.existsSync(path.join(RAIZ, 'hdri/estudio.hdr')), 'HDRI presente');
  const lam = JSON.parse(leerTexto('img/pared.json'));
  comprobar(lam.zonas?.length === 10 && lam.zonas.every((z, i) => z.slug === slugs[i] && z.w > 0 && z.h > 0 && z.x >= 0 && z.x + z.w <= 1), 'img/pared.json: diez huecos en orden y dentro de la imagen');
  if (lam.provisional) console.log('  ·      img/pared.webp es la PROVISIONAL (falta la captura de ?captura)');
  // Contraste de los tokens (texto sobre el fondo y sobre el panel).
  const pares = [['tinta-2 / fondo', '#a39e9a', '#1a1819', 4.5], ['tinta / fondo', '#edebe7', '#1a1819', 7], ['botón: fondo / tinta', '#1a1819', '#edebe7', 7],
    ['acento (precio del rótulo) / pared iluminada', '#ff6a1f', '#3b3638', 3], ['tinta-2 / pared iluminada', '#a39e9a', '#3b3638', 3]];
  for (const [n, a, b, min] of pares) { const r = ratio(a, b); comprobar(r >= min, `contraste ${n}: ${r.toFixed(2)} ≥ ${min}`); }
  // escena.js y app.js son JavaScript (módulo) válido.
  for (const f of ['js/escena.js', 'js/app.js', 'js/datos.js']) {
    const r = spawnSync(process.execPath, ['--experimental-default-type=module', '--check', path.join(RAIZ, f)], { encoding: 'utf8' });
    comprobar(r.status === 0, `${f}: sintaxis válida`, r.stderr?.split('\n').slice(0, 4).join(' '));
  }
  // Lo que importa escena.js existe en el CDN (versión exacta del importmap).
  const mapa = JSON.parse(leerTexto('index.html').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const usados = [...leerTexto('js/escena.js').matchAll(/from '(three[^']*)'/g)].map((m) => m[1]);
  const urls = usados.map((u) => (u === 'three' ? mapa.three : mapa['three/addons/'] + u.replace('three/addons/', '')));
  const estados = await Promise.all(urls.map((u) => fetch(u, { method: 'HEAD' }).then((r) => r.status).catch(() => 0)));
  comprobar(estados.every((s) => s === 200), `las ${urls.length} URL de Three.js responden 200`, urls.filter((_, i) => estados[i] !== 200));
}

const browser = await chromium.launch({ args: ['--disable-3d-apis'] });
try {
  const nuevo = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...opts });
    await ctx.route(/googleapis|gstatic/, (r) => r.abort());
    const page = await ctx.newPage();
    page.errores = [];
    page.on('pageerror', (e) => page.errores.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) page.errores.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) page.errores.push(`${r.status()} ${r.url()}`); });
    page.on('request', (r) => { if (/\.glb$|cdn\.jsdelivr/.test(r.url())) page.pide3D = true; });
    return { ctx, page };
  };
  const listo = (page) => page.waitForFunction(() => document.documentElement.classList.contains('plan-b') && document.querySelector('#lamina img').complete);
  const ficha = (page) => page.evaluate(() => ({ visible: !document.querySelector('#ficha').hidden, nombre: document.querySelector('.ficha-nombre').textContent.trim(), precio: document.querySelector('#ficha-precio').textContent, paso: document.querySelector('#paso-actual').textContent }));

  /* ---------- 2. Plan B en escritorio ---------- */
  if (toca(2)) {
    console.log('\n2. Plan B en escritorio (1280×800)');
    const { ctx, page } = await nuevo();
    await page.goto(BASE);
    await listo(page);
    const base = await page.evaluate(() => ({
      planB: document.documentElement.classList.contains('plan-b'), tres: document.documentElement.classList.contains('modo-3d'),
      lienzo: !!document.querySelector('#lienzo'), img: document.querySelector('#lamina img').naturalWidth,
      alto: document.scrollingElement.scrollHeight, vh: innerHeight, anchoPagina: document.documentElement.scrollWidth, vw: innerWidth,
      zonas: [...document.querySelectorAll('.zona')].map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }),
      cabecera: document.querySelector('.marca').textContent.trim(), lema: document.querySelector('.lema').textContent,
      secciones: document.querySelectorAll('section:not(#bolsa), article').length,
      cookies: !document.querySelector('#cookies').hidden, mando: document.querySelector('#mando').hidden,
    }));
    comprobar(base.planB && !base.tres, 'sin WebGL entra el plan B');
    comprobar(base.lienzo, 'el lienzo de la escena 3D existe');
    comprobar(!page.pide3D, 'en el plan B no se baja Three.js ni ningún GLB');
    comprobar(base.img === 4000, 'la imagen de la pared carga (4000 px)', base.img);
    comprobar(base.alto <= base.vh + 1 && base.anchoPagina <= base.vw, 'una sola pantalla: sin scroll de página', base);
    comprobar(base.secciones === 0, 'sin secciones debajo');
    comprobar(base.zonas.length === 10 && base.zonas.every(([w, h]) => w > 60 && h > 40), 'diez huecos pulsables con tamaño', base.zonas);
    comprobar(base.cabecera === 'BALDA' && /pared/.test(base.lema), 'logo y título arriba a la izquierda');
    comprobar(base.cookies, 'aviso de cookies a la vista la primera vez');
    comprobar(base.mando, 'sin ?revision el mando de versiones está oculto');

    // Ratón: rótulo bajo la balda.
    await page.hover('.zona[data-i="2"]');
    const rot = await page.evaluate(() => { const r = document.querySelector('#rotulo'); const z = document.querySelector('.zona[data-i="2"]').getBoundingClientRect(); const b = r.getBoundingClientRect(); return { vis: r.classList.contains('visible'), txt: r.textContent, debajo: b.top >= z.bottom - 1 && Math.abs((b.left + b.right) / 2 - (z.left + z.right) / 2) < 3 }; });
    comprobar(rot.vis && /Pegasus Trail/.test(rot.txt) && /139 €/.test(rot.txt), 'al pasar el ratón sale el rótulo con nombre y precio', rot.txt);
    comprobar(rot.debajo, 'el rótulo va centrado bajo su balda');

    // Pulsar: tarjeta.
    await page.click('.zona[data-i="2"]');
    let f = await ficha(page);
    comprobar(f.visible && /Nike\s+Pegasus Trail/.test(f.nombre) && f.precio === '139 €' && f.paso === '03 / 10', 'al pulsar sale la tarjeta de esa zapatilla', f);
    comprobar(await page.evaluate(() => location.hash === '#pegasus-trail'), 'la dirección lleva #pegasus-trail');
    const zoom = await page.evaluate(() => { const r = document.querySelector('.zona[data-i="2"]').getBoundingClientRect(); return { w: r.width / innerWidth, cx: (r.left + r.right) / 2 / innerWidth }; });
    comprobar(zoom.w > 0.35 && zoom.w < 0.75 && zoom.cx > 0.3 && zoom.cx < 0.6, 'la imagen se acerca: el hueco ocupa ~media pantalla, a la izquierda de la tarjeta', zoom);
    const tallas = await page.evaluate(() => [...document.querySelectorAll('#tallas input')].map((i) => [i.value, i.disabled]));
    comprobar(tallas.length === 9 && tallas.filter(([, d]) => d).map(([t]) => t).join() === '39,45,46', 'tallas 38-46 con las agotadas desactivadas', tallas);
    comprobar(await page.isDisabled('#anadir'), '«Añadir» desactivado hasta elegir talla');
    await page.click('.talla:has(input[value="42"])');
    comprobar(/42/.test(await page.textContent('#anadir')) && !(await page.isDisabled('#anadir')), 'elegir talla activa «Añadir» con la talla');
    await page.click('#anadir');
    const bolsa = await page.evaluate(() => ({ n: document.querySelector('#bolsa-n').textContent, ls: localStorage.getItem('balda-bolsa') }));
    comprobar(bolsa.n === '1' && /pegasus-trail/.test(bolsa.ls), 'añadir sube la bolsa a 1 y la guarda', bolsa);

    // Flechas y Esc.
    await page.keyboard.press('ArrowRight');
    f = await ficha(page);
    comprobar(/Reebok\s+Nano/.test(f.nombre) && f.paso === '04 / 10', '→ pasa a la siguiente', f);
    await page.click('#anterior');
    await page.click('#anterior');
    await page.click('#anterior');
    f = await ficha(page);
    comprobar(/FILA/.test(f.nombre) && f.paso === '01 / 10', 'la flecha ‹ de pantalla retrocede', f);
    await page.keyboard.press('ArrowLeft');
    f = await ficha(page);
    comprobar(/Salomon/.test(f.nombre) && f.paso === '10 / 10', '← desde la primera da la vuelta a la última', f);
    await page.keyboard.press('Escape');
    const vuelta = await page.evaluate(() => ({ ficha: document.querySelector('#ficha').hidden, foco: document.documentElement.classList.contains('en-foco'), hash: location.hash, activo: document.activeElement?.dataset?.i, t: document.querySelector('#lamina').style.transform }));
    comprobar(vuelta.ficha && !vuelta.foco && !vuelta.hash && !vuelta.t, 'Esc vuelve a la pared y quita el zoom', vuelta);
    comprobar(vuelta.activo === '9', 'Esc devuelve el foco del teclado al hueco que estaba abierto');

    // Teclado en la pared.
    await page.keyboard.press('ArrowRight');
    const tec = await page.evaluate(() => ({ activo: document.activeElement?.dataset?.i, rotulo: document.querySelector('#rotulo').textContent }));
    comprobar(tec.activo === '0' && /FILA/.test(tec.rotulo), 'en la pared, → recorre los huecos con rótulo sin abrirlos', tec);
    await page.keyboard.press('Enter');
    comprobar((await ficha(page)).visible, 'Enter abre la zapatilla con el teclado');
    await page.keyboard.press('Escape');

    // Bolsa.
    await page.click('#bolsa-boton');
    const pan = await page.evaluate(() => ({ vis: !document.querySelector('#bolsa').hidden, items: document.querySelectorAll('#bolsa-lista li').length, total: document.querySelector('#bolsa-total').textContent, nota: /no se cobra/.test(document.querySelector('#bolsa').textContent) }));
    comprobar(pan.vis && pan.items === 1 && pan.total === '139 €' && pan.nota, 'la bolsa lista lo añadido, el total y que es simulada', pan);
    await page.click('.quitar');
    comprobar(await page.evaluate(() => document.querySelector('#bolsa-n').textContent === '0'), 'quitar vacía la bolsa');
    await page.keyboard.press('Escape');
    comprobar(await page.evaluate(() => document.querySelector('#bolsa').hidden), 'Esc cierra la bolsa');

    // Créditos.
    await page.click('#creditos-boton');
    const cred = await page.evaluate(() => ({ abierto: document.querySelector('#creditos').open, n: document.querySelectorAll('#creditos-lista li').length, cc: [...document.querySelectorAll('#creditos-lista li')].filter((l) => /CC BY 4\.0/.test(l.textContent) && l.querySelector('a[href*="sketchfab.com/3d-models/"]')).length }));
    comprobar(cred.abierto && cred.n === 11 && cred.cc === 10, 'créditos: diez modelos CC BY con enlace + el HDRI', cred);
    await page.keyboard.press('Escape');

    // Cookies.
    await page.click('#cookies-ok');
    comprobar(await page.evaluate(() => document.querySelector('#cookies').hidden && localStorage.getItem('balda-cookies') === 'true'), 'el aviso de cookies se cierra y no vuelve');
    await page.reload();
    await listo(page);
    comprobar(await page.evaluate(() => document.querySelector('#cookies').hidden), 'al recargar, el aviso ya no sale');

    // Enlace directo.
    await page.goto(BASE + '#converse');
    await listo(page);
    await page.waitForFunction(() => !document.querySelector('#ficha').hidden);
    comprobar(/Converse/.test((await ficha(page)).nombre), 'index.html#converse abre esa zapatilla');

    comprobar(!page.errores.length, 'sin errores en consola ni 404', page.errores);
    await ctx.close();
  }

  /* ---------- 3. Plan B en el móvil ---------- */
  if (toca(3)) {
    console.log('\n3. Plan B en el móvil (390×844)');
    const { ctx, page } = await nuevo({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(BASE);
    await listo(page);
    const m = await page.evaluate(() => { const mc = document.querySelector('#lamina-marco'); return { arrastra: mc.scrollWidth > mc.clientWidth * 1.5, centrada: Math.abs(mc.scrollLeft - (mc.scrollWidth - mc.clientWidth) / 2) < 4, pagina: document.documentElement.scrollWidth <= innerWidth, pista: document.querySelector('#pista').textContent }; });
    comprobar(m.arrastra, 'la pared es más ancha que la pantalla y se recorre arrastrando');
    comprobar(m.centrada, 'empieza centrada');
    comprobar(m.pagina, 'sin scroll horizontal de la página');
    comprobar(/Arrastra/.test(m.pista), 'la pista habla de arrastrar y tocar', m.pista);
    await page.click('#cookies-ok');
    await page.tap('.zona[data-i="7"]');
    const f = await ficha(page);
    const caja = await page.evaluate(() => { const r = document.querySelector('#ficha').getBoundingClientRect(); const z = document.querySelector('.zona[data-i="7"]').getBoundingClientRect(); const p = document.querySelector('#pasos').getBoundingClientRect(); return { abajo: r.bottom <= innerHeight && r.top > innerHeight * 0.45, dentro: r.left >= 0 && r.right <= innerWidth, zapatilla: z.width / innerWidth, zbottom: z.bottom, ftop: r.top, pasos: p.top < r.top && p.bottom < innerHeight }; });
    comprobar(f.visible && /Ozweego/.test(f.nombre), 'tocar abre la zapatilla', f);
    comprobar(caja.abajo && caja.dentro, 'la tarjeta va abajo y cabe en la pantalla', caja);
    comprobar(caja.zapatilla > 0.6 && caja.zapatilla < 1.1, 'la zapatilla ocupa casi todo el ancho', caja.zapatilla);
    comprobar(caja.pasos, 'las flechas quedan a la vista, fuera de la tarjeta');
    await page.tap('#siguiente');
    comprobar(/Old Skool/.test((await ficha(page)).nombre), 'la flecha de pantalla pasa a la siguiente');
    // Deslizar con el dedo pasa de zapatilla (gesto en el escenario).
    await page.evaluate(() => {
      const e = document.querySelector('#escenario');
      const ev = (t, x) => e.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: 300, bubbles: true }));
      ev('pointerdown', 300); ev('pointermove', 240); ev('pointermove', 160); ev('pointerup', 160);
    });
    comprobar(/Salomon/.test((await ficha(page)).nombre), 'deslizar hacia la izquierda pasa a la siguiente');
    comprobar(!page.errores.length, 'sin errores en consola ni 404', page.errores);
    await ctx.close();
  }

  /* ---------- 4. Mando de versiones con ?revision ---------- */
  if (toca(4)) {
    console.log('\n4. Mando de dos versiones (?revision)');
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '?revision');
    await listo(page);
    comprobar(await page.isVisible('#mando'), 'con ?revision el mando se ve');
    await page.click('[data-densidad="sobria"]');
    comprobar(await page.evaluate(() => document.documentElement.classList.contains('sobria') && getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() === '#edebe7'), '«Sobria» quita el naranja');
    await page.goto(BASE);
    await listo(page);
    comprobar(await page.evaluate(() => !document.documentElement.classList.contains('sobria')), 'sin ?revision no se aplica la versión guardada');
    comprobar(!page.errores.length, 'sin errores en consola', page.errores);
    await ctx.close();
  }

  /* ---------- 5. Legal y 404 ---------- */
  if (toca(5)) {
    console.log('\n5. Aviso legal y 404');
    const { ctx, page } = await nuevo();
    await page.goto(BASE + 'legal.html');
    const l = await page.evaluate(() => ({ cookies: !!document.querySelector('#cookies'), claves: ['balda-bolsa', 'balda-cookies', 'balda-giro-visto', 'balda-densidad'].every((k) => document.body.textContent.includes(k)), cc: /Creative Commons/.test(document.body.textContent) }));
    comprobar(l.cookies && l.claves, 'legal explica las cuatro claves que se guardan');
    comprobar(l.cc, 'legal cita la licencia de los modelos');
    await page.goto(BASE + '404.html');
    comprobar(await page.isVisible('a[href="./"]'), '404 con vuelta a la pared');
    comprobar(!page.errores.length, 'sin errores', page.errores);
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} ok, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exit(1); }
