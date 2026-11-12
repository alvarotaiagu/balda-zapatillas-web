/* Balda: interfaz. Diez botones invisibles encima de la pared (uno por hueco) sirven
   para las dos vistas: la escena 3D (escena.js) y el plan B sin WebGL (una imagen fija
   de la misma pared). La tarjeta, las flechas, Esc y la bolsa son los mismos en las dos. */
import { PRODUCTOS, CREDITOS, HDRI } from './datos.js';

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const mqReducido = matchMedia('(prefers-reduced-motion: reduce)');
const reducido = () => mqReducido.matches;
const N = PRODUCTOS.length;
const euros = (n) => `${n} €`;

const estado = { modo: 'pared', i: null, resaltada: null, talla: null, vista: null };

/* ---------- Almacenamiento (todo con try: en privado puede fallar) ---------- */
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const leer = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };

/* ---------- Botones de la pared ---------- */
const zonas = $('#zonas');
const botones = PRODUCTOS.map((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'zona';
  b.dataset.i = i;
  b.setAttribute('aria-label', `${p.marca} ${p.modelo}, ${euros(p.precio)}. Ver de cerca`);
  zonas.append(b);
  return b;
});

/* ---------- Rótulo bajo la balda señalada ---------- */
const rotulo = $('#rotulo');
function colocarRotulo() {
  const i = estado.resaltada;
  if (i === null || estado.modo !== 'pared') { rotulo.classList.remove('visible'); return; }
  // En 3D, el rectángulo que acaba de mandar la escena (leer el botón forzaría a recalcular la página).
  const r = rectsEscena ? { left: rectsEscena[i].x, width: rectsEscena[i].w, bottom: rectsEscena[i].y + rectsEscena[i].h } : botones[i].getBoundingClientRect();
  rotulo.style.transform = `translate(${Math.round(r.left + r.width / 2)}px, ${Math.round(r.bottom + 10)}px) translateX(-50%)`;
  rotulo.classList.add('visible');
}
function resaltar(i) {
  if (estado.modo === 'foco' && i !== null) return;
  estado.resaltada = i;
  botones.forEach((b, k) => b.classList.toggle('activa', k === i));
  if (i !== null) {
    const p = PRODUCTOS[i];
    $('.rotulo-nombre', rotulo).textContent = `${p.marca} ${p.modelo}`;
    $('.rotulo-precio', rotulo).textContent = euros(p.precio);
  }
  estado.vista?.resaltar(i);
  colocarRotulo();
}

/* ---------- Tarjeta ---------- */
const ficha = $('#ficha');
const anadir = $('#anadir');
function pintarFicha(i) {
  const p = PRODUCTOS[i];
  estado.talla = null;
  $('#ficha-serie').textContent = `Balda ${String(i + 1).padStart(2, '0')} · ${p.tipo}`;
  $('#ficha-marca').textContent = p.marca;
  $('#ficha-modelo').textContent = p.modelo;
  $('#ficha-color').textContent = p.color;
  $('#ficha-precio').textContent = euros(p.precio);
  const caja = $('#tallas');
  caja.replaceChildren(...p.tallas.map(({ t, hay }) => {
    const l = document.createElement('label');
    l.className = 'talla';
    l.innerHTML = `<input type="radio" name="talla" value="${t}"${hay ? '' : ' disabled'}><span>${t}</span>`;
    if (!hay) l.title = 'Agotada';
    return l;
  }));
  anadir.disabled = true;
  anadir.textContent = 'Elige una talla';
  $('#paso-actual').textContent = `${String(i + 1).padStart(2, '0')} / ${N}`;
}
$('#tallas').addEventListener('change', (e) => {
  estado.talla = e.target.value;
  anadir.disabled = false;
  anadir.textContent = `Añadir a la bolsa · ${estado.talla}`;
});

/* ---------- Modo pared / modo foco ---------- */
function enfocar(i, { desdeHash = false } = {}) {
  if (i === estado.i && estado.modo === 'foco') return;
  estado.modo = 'foco';
  estado.i = i;
  estado.resaltada = null;
  botones.forEach((b, k) => { b.classList.remove('activa'); b.classList.toggle('actual', k === i); b.tabIndex = k === i ? -1 : 0; });
  rotulo.classList.remove('visible');
  html.classList.add('en-foco');
  pintarFicha(i);
  ficha.hidden = false;
  $('#pasos').hidden = false;
  $('#volver').hidden = false;
  estado.vista?.enfocar(i);
  if (!desdeHash) history.replaceState(null, '', `#${PRODUCTOS[i].slug}`);
  ocultarPista();
  mostrarPistaGiro(true);
}
function volverPared() {
  if (estado.modo !== 'foco') return;
  const i = estado.i;
  estado.modo = 'pared';
  estado.i = null;
  html.classList.remove('en-foco', 'girando');
  mostrarPistaGiro(false);
  ficha.hidden = true;
  $('#pasos').hidden = true;
  $('#volver').hidden = true;
  botones.forEach((b) => { b.classList.remove('actual'); b.tabIndex = 0; });
  estado.vista?.enfocar(null);
  history.replaceState(null, '', location.pathname + location.search);
  botones[i]?.focus({ preventScroll: true });
}
const paso = (d) => { if (estado.modo === 'foco') enfocar((estado.i + d + N) % N); };

$('#volver').addEventListener('click', volverPared);
$('#anterior').addEventListener('click', () => paso(-1));
$('#siguiente').addEventListener('click', () => paso(1));

/* ---------- Gestos: ratón, teclado, dedo ---------- */
let arrastre = null, acabaDeArrastrar = false;
// En 3D, la zapatilla abierta se gira arrastrando y se acerca con la rueda o pellizcando.
const giraEn3D = () => estado.modo === 'foco' && html.classList.contains('modo-3d');
const toques = new Map();
let pellizco = null, ultimoToque = null;
const distancia = () => { const [a, b] = [...toques.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
botones.forEach((b, i) => {
  b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') resaltar(i); });
  b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && estado.resaltada === i) resaltar(null); });
  b.addEventListener('focus', () => { if (b.matches(':focus-visible')) resaltar(i); });
  b.addEventListener('blur', () => { if (estado.resaltada === i) resaltar(null); });
  b.addEventListener('click', () => {
    if (acabaDeArrastrar) return;
    if (estado.modo === 'foco' && estado.i === i) return;
    enfocar(i);
  });
});

const escenario = $('#escenario');
escenario.addEventListener('pointermove', (e) => {
  if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pellizco && toques.size === 2) {
    const d = distancia();
    if (d > 0 && pellizco.d > 0) { estado.vista?.acercar?.(pellizco.d / d); usoGiro(); }
    pellizco.d = d;
    return;
  }
  if (e.pointerType === 'mouse' && !arrastre?.movido) {
    const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
    estado.vista?.puntero?.(nx, ny);
  }
  if (!arrastre || arrastre.id !== e.pointerId) return;
  const dx = e.clientX - arrastre.x0, dy = e.clientY - arrastre.y0;
  if (!arrastre.movido && Math.hypot(dx, dy) > (giraEn3D() ? 3 : 8)) {
    arrastre.movido = true;
    // Ya es un giro (no un clic): que siga aunque el puntero pase por encima de la tarjeta.
    if (giraEn3D()) try { escenario.setPointerCapture(e.pointerId); } catch {}
  }
  if (arrastre.movido) {
    if (estado.modo === 'pared') estado.vista?.arrastrar?.(e.clientX - arrastre.xu);
    else if (giraEn3D()) {
      estado.vista?.girar?.(e.clientX - arrastre.xu, e.clientY - arrastre.yu);
      html.classList.add('girando');
      usoGiro();
    }
  }
  arrastre.xu = e.clientX; arrastre.yu = e.clientY;
});
escenario.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.isPrimary) { toques.clear(); pellizco = null; }   // gesto nuevo: fuera toques que no llegaron a soltarse
  toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (toques.size === 2 && giraEn3D()) {
    // Dos dedos: deja de girar y pasa a acercar.
    if (arrastre?.movido) { acabaDeArrastrar = true; setTimeout(() => { acabaDeArrastrar = false; }, 0); }
    arrastre = null;
    html.classList.remove('girando');
    estado.vista?.soltarGiro?.();
    pellizco = { d: distancia() };
    return;
  }
  if (toques.size > 1) return;
  arrastre = { id: e.pointerId, x0: e.clientX, y0: e.clientY, xu: e.clientX, yu: e.clientY, movido: false };
});
const finArrastre = (e) => {
  toques.delete(e.pointerId);
  if (toques.size < 2) pellizco = null;
  if (!arrastre || arrastre.id !== e.pointerId) return;
  const dx = e.clientX - arrastre.x0, dy = e.clientY - arrastre.y0;
  if (arrastre.movido) {
    acabaDeArrastrar = true;
    setTimeout(() => { acabaDeArrastrar = false; }, 0);
    if (giraEn3D()) { html.classList.remove('girando'); estado.vista?.soltarGiro?.(); }
    // Sin 3D (la imagen fija), deslizar sigue pasando de zapatilla.
    else if (estado.modo === 'foco' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) paso(dx < 0 ? 1 : -1);
    estado.vista?.soltarArrastre?.();
    ocultarPista();
  } else if (giraEn3D() && e.type === 'pointerup' && e.pointerType !== 'mouse' && !e.target.closest?.('.zona:not(.actual)')) {
    // Doble toque con el dedo: otra vez de frente (con el ratón lo hace el doble clic).
    const ahora = performance.now();
    if (ultimoToque && ahora - ultimoToque.t < 320 && Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 30) {
      estado.vista?.reiniciar?.(); ultimoToque = null;
    } else ultimoToque = { t: ahora, x: e.clientX, y: e.clientY };
  }
  arrastre = null;
};
escenario.addEventListener('wheel', (e) => {
  if (!giraEn3D()) return;
  e.preventDefault();
  const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
  estado.vista?.acercar?.(Math.exp(Math.max(-120, Math.min(120, px)) * 0.0016));
  usoGiro();
}, { passive: false });
escenario.addEventListener('dblclick', (e) => {
  if (!giraEn3D() || e.target.closest('.zona:not(.actual)')) return;
  estado.vista?.reiniciar?.();
});
$('#centrar').addEventListener('click', () => estado.vista?.reiniciar?.());
escenario.addEventListener('pointerup', finArrastre);
escenario.addEventListener('pointercancel', finArrastre);

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if ($('dialog[open]')) return;
  if (!$('#bolsa').hidden && e.key === 'Escape') { cerrarBolsa(); return; }
  if (e.key === 'Escape') { volverPared(); return; }
  if (e.target.closest?.('input, .tallas')) return;
  // En 3D, con la zapatilla abierta: flechas para girarla, + y − para acercar, 0 para verla de frente
  // y [ ] (o Re Pág / Av Pág) para pasar de zapatilla.
  if (giraEn3D()) {
    const v = estado.vista, q = Math.PI / 8;
    const teclas = {
      ArrowLeft: () => v.girarPaso(-q, 0), ArrowRight: () => v.girarPaso(q, 0),
      ArrowUp: () => v.girarPaso(0, -0.25), ArrowDown: () => v.girarPaso(0, 0.25),
      '+': () => v.acercar(0.85), '=': () => v.acercar(0.85), '-': () => v.acercar(1 / 0.85),
      '0': () => v.reiniciar(), Home: () => v.reiniciar(),
      '[': () => paso(-1), PageUp: () => paso(-1), ']': () => paso(1), PageDown: () => paso(1),
    };
    const f = teclas[e.key];
    if (f) { e.preventDefault(); f(); if (!/[[\]]|Page/.test(e.key)) usoGiro(); }
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const d = e.key === 'ArrowRight' ? 1 : -1;
    if (estado.modo === 'foco') { e.preventDefault(); paso(d); return; }
    // En la pared, las flechas pasan por las zapatillas sin abrirlas.
    const actual = estado.resaltada ?? (d > 0 ? -1 : 0);
    const sig = (actual + d + N) % N;
    e.preventDefault();
    botones[sig].focus({ preventScroll: true });
    resaltar(sig);
  }
});

/* ---------- Pista de uso ---------- */
const pista = $('#pista');
if (matchMedia('(hover: none)').matches) pista.textContent = 'Arrastra la pared · Toca una zapatilla';
function ocultarPista() { pista.classList.add('oculta'); }
// La de girar sale al abrir una zapatilla en 3D, hasta que la mueves por primera vez.
const pistaGiro = $('#pista-giro');
if (matchMedia('(hover: none)').matches) pistaGiro.textContent = 'Arrastra para girarla · Pellizca para acercar · Doble toque, de frente';
let giroVisto = leer('balda-giro-visto', false);
function mostrarPistaGiro(si) { pistaGiro.classList.toggle('visible', si && !giroVisto && html.classList.contains('modo-3d')); }
function usoGiro() {
  if (giroVisto) return;
  giroVisto = true;
  guardar('balda-giro-visto', true);
  mostrarPistaGiro(false);
}

/* ---------- Bolsa (simulada) ---------- */
let bolsa = leer('balda-bolsa', []).filter((x) => PRODUCTOS.some((p) => p.slug === x.slug));
function pintarBolsa() {
  $('#bolsa-n').textContent = bolsa.length;
  const lista = $('#bolsa-lista');
  if (!bolsa.length) {
    lista.innerHTML = '<li class="bolsa-vacia">Todavía no hay nada.</li>';
    $('#bolsa-total').textContent = euros(0);
    return;
  }
  lista.replaceChildren(...bolsa.map((x, k) => {
    const p = PRODUCTOS.find((q) => q.slug === x.slug);
    const li = document.createElement('li');
    li.innerHTML = `<span><strong>${p.marca} ${p.modelo}</strong><small>Talla ${x.talla} · ${p.color}</small></span><span class="bolsa-precio">${euros(p.precio)}</span>`;
    const quitar = document.createElement('button');
    quitar.type = 'button'; quitar.className = 'quitar'; quitar.textContent = 'Quitar';
    quitar.setAttribute('aria-label', `Quitar ${p.marca} ${p.modelo}, talla ${x.talla}`);
    quitar.addEventListener('click', () => { bolsa.splice(k, 1); guardar('balda-bolsa', bolsa); pintarBolsa(); $('#bolsa-cerrar').focus(); });
    li.append(quitar);
    return li;
  }));
  $('#bolsa-total').textContent = euros(bolsa.reduce((s, x) => s + PRODUCTOS.find((q) => q.slug === x.slug).precio, 0));
}
anadir.addEventListener('click', () => {
  if (estado.i === null || !estado.talla) return;
  bolsa.push({ slug: PRODUCTOS[estado.i].slug, talla: estado.talla });
  guardar('balda-bolsa', bolsa);
  pintarBolsa();
  anadir.textContent = 'Añadida ✓';
  anadir.disabled = true;
  const boton = $('#bolsa-boton');
  boton.classList.remove('latido'); void boton.offsetWidth; boton.classList.add('latido');
  setTimeout(() => {
    if (estado.talla && anadir.textContent === 'Añadida ✓') { anadir.disabled = false; anadir.textContent = `Añadir a la bolsa · ${estado.talla}`; }
  }, 1400);
});
function abrirBolsa() { $('#bolsa').hidden = false; $('#bolsa-boton').setAttribute('aria-expanded', 'true'); $('#bolsa-cerrar').focus(); }
function cerrarBolsa() { $('#bolsa').hidden = true; $('#bolsa-boton').setAttribute('aria-expanded', 'false'); $('#bolsa-boton').focus(); }
$('#bolsa-boton').addEventListener('click', () => ($('#bolsa').hidden ? abrirBolsa() : cerrarBolsa()));
$('#bolsa-cerrar').addEventListener('click', cerrarBolsa);
pintarBolsa();

/* ---------- Créditos ---------- */
const creditos = $('#creditos');
$('#creditos-lista').innerHTML = CREDITOS.map((c) => {
  const p = PRODUCTOS.find((q) => q.slug === c.slug);
  return `<li><span class="cred-producto">${p.marca} ${p.modelo}</span> «<a href="${c.url}" target="_blank" rel="noopener">${c.titulo}</a>», de <a href="${c.autorUrl}" target="_blank" rel="noopener">${c.autor}</a> · ${c.licencia}</li>`;
}).join('') + `<li><span class="cred-producto">Luz</span> «<a href="${HDRI.url}" target="_blank" rel="noopener">${HDRI.titulo}</a>», de ${HDRI.autor} · ${HDRI.licencia}</li>`;
$('#creditos-boton').addEventListener('click', () => creditos.showModal());
$('#creditos-cerrar').addEventListener('click', () => creditos.close());
creditos.addEventListener('click', (e) => { if (e.target === creditos) creditos.close(); });

/* ---------- Aviso de cookies ---------- */
const aviso = $('#cookies');
if (!leer('balda-cookies', false)) aviso.hidden = false;
$('#cookies-ok').addEventListener('click', () => { guardar('balda-cookies', true); aviso.hidden = true; });

/* ---------- Mando de las dos versiones (solo con ?revision) ---------- */
const mando = $('#mando');
if (params.has('revision')) {
  mando.hidden = false;
  const poner = (d) => {
    html.classList.toggle('sobria', d === 'sobria');
    mando.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.densidad === d)));
    estado.vista?.densidad?.(d);
    guardar('balda-densidad', d);
  };
  mando.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => poner(b.dataset.densidad)));
  poner(html.classList.contains('sobria') ? 'sobria' : 'escaparate');
}

/* ---------- Estado de carga ---------- */
const avisoCarga = $('#estado');
function progreso(n, total) {
  avisoCarga.textContent = n < total ? `Encendiendo la pared · ${n}/${total}` : '';
  avisoCarga.hidden = n >= total;
}

/* ---------- Elegir vista: 3D o plan B ---------- */
function hayWebGL() {
  if (params.has('sin3d')) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

let rectsEscena = null;
function colocarBotones(rects) {
  rectsEscena = rects;
  for (let i = 0; i < N; i++) {
    const r = rects[i], s = botones[i].style;
    s.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`;
    s.width = `${r.w.toFixed(1)}px`; s.height = `${r.h.toFixed(1)}px`;
  }
  colocarRotulo();
}

/* ?fps: contador pequeño para saber cómo va en cada ordenador. */
const contador = params.has('fps') ? Object.assign(document.createElement('p'), { className: 'contador' }) : null;
if (contador) { contador.textContent = 'mueve el ratón por la pared…'; document.body.append(contador); }
function medida({ fps, nitidez, calidad }) {
  if (contador) contador.textContent = `${fps} fps · nitidez ${nitidez} · calidad ${['alta', 'media', 'baja'][calidad]}`;
}

async function montar3D() {
  const medidas = await fetch('modelos/medidas.json').then((r) => r.json());
  const { crearEscena } = await import('./escena.js?v=giro1');
  const vista = await crearEscena({
    lienzo: $('#lienzo'), productos: PRODUCTOS, medidas, reducido,
    alRects: colocarBotones, alProgreso: progreso, alMedida: medida, captura: params.has('captura'),
  });
  html.classList.add('modo-3d');
  $('#centrar').hidden = false;
  $('#pasos-teclas').hidden = false;
  for (const b of ['#anterior', '#siguiente', '#centrar']) $(b).setAttribute('aria-describedby', 'pasos-teclas');
  vista.alPerderContexto(() => { html.classList.remove('modo-3d', 'girando'); montarLamina(); });
  if (html.classList.contains('sobria')) vista.densidad('sobria');
  if (params.has('captura')) prepararCaptura(vista);
  return vista;
}

/* Plan B: la imagen fija de la pared, con los mismos botones por encima. */
async function montarLamina() {
  rectsEscena = null;
  html.classList.remove('modo-3d');
  html.classList.add('plan-b');
  $('#centrar').hidden = true;
  $('#pasos-teclas').hidden = true;
  for (const b of ['#anterior', '#siguiente', '#centrar']) $(b).removeAttribute('aria-describedby');
  mostrarPistaGiro(false);
  botones.forEach((b) => { b.style.transform = ''; });
  const marco = $('#lamina-marco'), lamina = $('#lamina'), img = $('#lamina img');
  marco.hidden = false;
  img.src = img.dataset.src;   // solo se baja en el plan B
  const datos = await fetch('img/pared.json').then((r) => r.json());
  lamina.style.aspectRatio = `${datos.ancho} / ${datos.alto}`;
  lamina.append(zonas);
  datos.zonas.forEach((z, i) => {
    const s = botones[i].style;
    s.left = `${z.x * 100}%`; s.top = `${z.y * 100}%`; s.width = `${z.w * 100}%`; s.height = `${z.h * 100}%`;
  });
  progreso(N, N);
  const centrar = () => { marco.scrollLeft = (marco.scrollWidth - marco.clientWidth) / 2; };
  centrar();
  img.addEventListener('load', centrar, { once: true });

  // Acercar = escalar la imagen hasta ese hueco, como haría la cámara.
  function encuadrar(i) {
    if (i === null) { lamina.style.transform = ''; marco.classList.remove('acercada'); centrar(); return; }
    const z = datos.zonas[i];
    const vw = marco.clientWidth, vh = marco.clientHeight;
    const W = lamina.offsetWidth, H = lamina.offsetHeight;   // tamaño sin la escala aplicada
    const vertical = vw / vh < 0.9;
    const s = Math.min(4, ((vertical ? 0.86 : 0.5) * vw) / (z.w * W));
    const cx = (z.x + z.w / 2) * W, cy = (z.y + z.h / 2) * H;
    const X = vw * (vertical ? 0.5 : 0.46), Y = vh * (vertical ? 0.36 : 0.5);
    marco.classList.add('acercada');
    marco.scrollLeft = 0;
    // La imagen puede ir centrada con márgenes: se resta su sitio en el marco.
    const tx = X - lamina.offsetLeft - cx * s, ty = Y - lamina.offsetTop - cy * s;
    lamina.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }
  const vista = {
    resaltar() {},
    enfocar: encuadrar,
  };
  addEventListener('resize', () => { if (estado.modo === 'foco') encuadrar(estado.i); });
  estado.vista = vista;
  if (estado.modo === 'foco') encuadrar(estado.i);
  return vista;
}

/* ?captura: deja descargar la imagen del plan B desde un Chrome con tarjeta gráfica. */
function prepararCaptura(vista) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'boton-captura'; b.textContent = 'Descargar imagen del plan B';
  document.body.append(b);
  b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Cargando los modelos de detalle…';
    if (estado.modo === 'foco') volverPared();
    const { blob, datos } = await vista.captura();
    const bajar = (data, nombre) => { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    bajar(blob, 'pared.png');
    bajar(new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' }), 'pared.json');
    b.textContent = 'Hecho: pared.png y pared.json en Descargas';
  });
}

(async () => {
  try {
    estado.vista = hayWebGL() ? await montar3D() : await montarLamina();
  } catch (err) {
    console.warn('Sin escena 3D, paso a la imagen fija:', err);
    estado.vista = await montarLamina();
  }
  // Enlace directo a una zapatilla: #pegasus-trail (al cargar o al cambiar la dirección a mano).
  const segunHash = () => {
    const i = PRODUCTOS.findIndex((p) => `#${p.slug}` === location.hash);
    if (i >= 0) enfocar(i, { desdeHash: true }); else if (!location.hash) volverPared();
  };
  segunHash();
  addEventListener('hashchange', segunHash);
})();
