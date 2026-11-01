/* Balda: la pared en Three.js.
   Una sola escena: pared oscura, dos filas de baldas de metacrilato y diez zapatillas.
   Luz: HDRI de estudio suave + foco cálido desde arriba y delante (sombras blandas) + un
   rebote cálido desde abajo. La balda señalada se enciende en naranja (canto, cristal y pared).
   Solo pinta cuando algo cambia. La interfaz (botones, tarjeta) vive en app.js. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* Medidas de la pared, en metros. */
const PASO = 0.38;                 // entre centros de balda
const FILAS = [0.19, -0.21];        // cara de arriba de cada fila de baldas
const ANCHO_BALDA = 0.33, GROSOR = 0.012, FONDO = 0.17;
const Z_ZAP = 0.088;               // centro de la zapatilla sobre la balda
const FOV = 28;
const T = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const CONTENIDO = { ancho: 5 * PASO + 0.25, alto: 0.9, centroY: 0.075 };

// Colores escritos como se ven en pantalla (sRGB); Three.js los pasa a lineal. Escritos en lineal
// salían aclarados: el naranja acababa en melocotón.
const ACENTO = new THREE.Color('#ff5f1a');            // naranja de balda encendida
const ACENTO_SOBRIO = new THREE.Color(0.95, 0.93, 0.9);
const CANTO = new THREE.Color(0.42, 0.43, 0.42);     // canto apagado: el filo claro del metacrilato
const CANTO_ENCENDIDO = new THREE.Color('#ff8a3c');   // el centro del tubo, algo más claro que el halo
const V = THREE.Vector3;

export const bahia = (i) => ({ x: ((i % 5) - 2) * PASO, y: FILAS[Math.floor(i / 5)] });
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export async function crearEscena({ lienzo, productos, medidas, reducido, alRects, alProgreso, alMedida, captura = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: captura });
  const movil = matchMedia('(hover: none)').matches;
  // Nitidez: como mucho 1,5 (a 2 son casi el doble de píxeles y no se nota). Baja sola si va lento.
  let nitidez = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(nitidez);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;   // el desenfoque solo se paga cuando cambia la sombra
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141213);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 20);

  /* ---------- Luz ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync('hdri/estudio.hdr');
  const envMap = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose(); pmrem.dispose();
  scene.environment = envMap;

  const foco = new THREE.SpotLight(0xfff0e0, 15, 0, 0.6, 0.9, 2);
  foco.position.set(0.2, 1.3, 2.35);
  foco.target.position.set(0, 0, 0);
  foco.castShadow = true;
  foco.shadow.mapSize.set(1024, 1024);
  foco.shadow.camera.near = 1.4; foco.shadow.camera.far = 4.5;
  foco.shadow.radius = 9; foco.shadow.blurSamples = 10;
  foco.shadow.bias = -0.0004;
  scene.add(foco, foco.target);

  // Rebote cálido desde abajo (las baldas): barato, sin posición.
  scene.add(new THREE.HemisphereLight(0x2a2b30, 0xffb480, 0.35));

  /* ---------- Pared ---------- */
  const yeso = texturaYeso();
  yeso.repeat.set(9 / 0.8, 5 / 0.8);
  const pared = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5),
    new THREE.MeshStandardMaterial({ color: 0x575053, roughness: 0.94, metalness: 0, bumpMap: yeso, bumpScale: 0.5, envMapIntensity: 0.22 }),
  );
  pared.position.set(0, CONTENIDO.centroY, 0);
  pared.receiveShadow = true;
  scene.add(pared);

  /* ---------- Baldas ---------- */
  const geoBalda = new RoundedBoxGeometry(ANCHO_BALDA, GROSOR, FONDO, 2, 0.0025);
  const geoCanto = new THREE.BoxGeometry(ANCHO_BALDA - 0.006, GROSOR * 0.55, 0.002);
  const geoSoporte = new RoundedBoxGeometry(0.014, 0.028, 0.01, 2, 0.0015);
  const matSoporte = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.05, depthWrite: false, envMapIntensity: 1.2 });
  const geoBrillo = new THREE.PlaneGeometry(0.62, 0.3);
  const texBrillo = texturaBrillo();
  // Halo del canto: un plano con degradado delante del filo (hace de «bloom» sin posproceso).
  const geoHalo = new THREE.PlaneGeometry(ANCHO_BALDA + 0.07, 0.07);
  const texHalo = texturaHalo();
  const n = productos.length;
  const baldas = [], cantos = [], brillos = [], halos = [], grupos = [];
  const encendido = new Float32Array(n), objetivo = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const { x, y } = bahia(i);
    // Metacrilato sin «transmission» (que pinta la escena dos veces por fotograma): transparencia
    // normal con reflejo del HDRI y capa de barniz para el brillo del canto.
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xf2f5f6, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.05, depthWrite: false,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, emissive: ACENTO.clone(), emissiveIntensity: 0,
    });
    const balda = new THREE.Mesh(geoBalda, mat);
    balda.position.set(x, y - GROSOR / 2, FONDO / 2);
    balda.receiveShadow = true;
    // toneMapped: false para que el naranja salga naranja (el tono de imagen lo pasaba a amarillo).
    const canto = new THREE.Mesh(geoCanto, new THREE.MeshBasicMaterial({ color: CANTO.clone(), toneMapped: false }));
    canto.position.set(x, y - GROSOR / 2, FONDO + 0.0008);
    const halo = new THREE.Mesh(geoHalo, new THREE.MeshBasicMaterial({
      map: texHalo, color: ACENTO.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    halo.position.set(x, y - GROSOR / 2, FONDO + 0.004);
    halo.renderOrder = 2;
    // Dos tacos transparentes contra la pared, como en un expositor real.
    for (const dx of [-0.12, 0.12]) {
      const s = new THREE.Mesh(geoSoporte, matSoporte);
      s.position.set(x + dx, y - GROSOR - 0.014, 0.005);
      scene.add(s);
    }
    const brillo = new THREE.Mesh(geoBrillo, new THREE.MeshBasicMaterial({
      map: texBrillo, color: ACENTO.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    brillo.position.set(x, y - 0.06, 0.0015);
    const grupo = new THREE.Group();
    grupo.position.set(x, y, Z_ZAP);
    scene.add(balda, canto, halo, brillo, grupo);
    baldas.push(balda); cantos.push(canto); halos.push(halo); brillos.push(brillo); grupos.push(grupo);
  }

  let densidad = 'escaparate';

  /* ---------- Cámara ---------- */
  const base = { pos: new V(), mira: new V() };
  const off = new V(), offObj = new V();
  let anim = null, modo = 'pared', actual = null;
  let panX = 0, panV = 0, arrastrando = false;
  let giro = 0, giroObj = 0;

  const aspecto = () => camera.aspect;
  const vertical = () => aspecto() < 0.9;
  function limitePan() {
    if (!vertical()) return 0;
    const visW = 0.8;
    return Math.max(0, CONTENIDO.ancho / 2 - visW / 2 + 0.02);
  }
  function encuadrePared() {
    const a = aspecto();
    let d;
    if (a < 0.9) d = 0.8 / (2 * T * a);
    else d = Math.max(CONTENIDO.alto / 2 / T, CONTENIDO.ancho / 2 / (T * a)) * 1.12;
    const x = vertical() ? panX : 0;
    return { pos: new V(x, CONTENIDO.centroY + 0.02, d), mira: new V(x, CONTENIDO.centroY, 0) };
  }
  function encuadreFoco(i) {
    const a = aspecto(), { x, y } = bahia(i);
    const alto = medidas[productos[i].slug]?.alto ?? 0.15;
    const f = a < 0.9 ? 0.84 : 0.5;            // parte del ancho que ocupa la zapatilla
    const visW = 0.3 / f, d = visW / (2 * T * a), visH = 2 * d * T;
    const ox = a < 0.9 ? 0 : visW * 0.035;     // un poco a la izquierda: la tarjeta va a la derecha
    const oy = a < 0.9 ? -visH * 0.13 : -visH * 0.02;  // en el móvil, más arriba: la tarjeta va abajo
    const cy = y + alto / 2;
    return { pos: new V(x + ox, cy + oy + 0.035, Z_ZAP + d), mira: new V(x + ox, cy + oy, Z_ZAP) };
  }
  function ir(destino, dur, arco = 0) {
    if (reducido() || dur === 0) { base.pos.copy(destino.pos); base.mira.copy(destino.mira); anim = null; despertar(); return; }
    anim = { dp: base.pos.clone(), dm: base.mira.clone(), hp: destino.pos, hm: destino.mira, t0: performance.now(), dur, arco };
    despertar();
  }

  /* ---------- Bucle: solo pinta si algo cambia ---------- */
  let raf = 0, prev = 0, sombrasSucias = true, seguido = false, cuentaGiro = 0;
  const tmp = new V();
  function despertar() { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(cuadro); } }

  /* Calidad automática: si los fotogramas seguidos van lentos, baja la nitidez (1 y luego 0,8). */
  let calidad = 0;
  const tiempos = [];
  let medirDesde = Infinity;
  function medir(ms) {
    if (performance.now() < medirDesde) return;
    tiempos.push(ms);
    if (tiempos.length < 45) return;
    const orden = [...tiempos].sort((a, b) => a - b), mediana = orden[orden.length >> 1];
    tiempos.length = 0;
    alMedida?.({ fps: Math.round(1000 / mediana), nitidez, calidad });
    if (mediana > 24 && calidad < 2 && !captura) {
      calidad++;
      nitidez = calidad === 1 ? Math.min(1, nitidez) : 0.8;
      renderer.setPixelRatio(nitidez);
      ajustar();
    }
  }
  function cuadro(ahora) {
    raf = 0;
    if (seguido) medir(ahora - prev);
    const dt = Math.min(0.05, (ahora - prev) / 1000); prev = ahora;
    let sigue = false;
    if (anim) {
      let t = (ahora - anim.t0) / anim.dur;
      if (t >= 1) t = 1; else sigue = true;
      const e = ease(t);
      base.pos.lerpVectors(anim.dp, anim.hp, e);
      base.mira.lerpVectors(anim.dm, anim.hm, e);
      if (anim.arco) base.pos.z += Math.sin(Math.PI * t) * anim.arco;
      if (t === 1) anim = null;
    }
    // Arrastre en el móvil, con inercia.
    if (modo === 'pared' && vertical() && !anim) {
      if (!arrastrando && Math.abs(panV) > 1e-4) { panX += panV * dt; panV *= Math.exp(-dt * 5); sigue = true; }
      const lim = limitePan();
      const dentro = THREE.MathUtils.clamp(panX, -lim, lim);
      if (dentro !== panX) { panX += (dentro - panX) * (1 - Math.exp(-dt * 12)); if (!arrastrando) panV = 0; sigue = true; }
      const e = encuadrePared(); base.pos.copy(e.pos); base.mira.copy(e.mira);
    }
    const k = 1 - Math.exp(-dt * 4);
    off.lerp(offObj, k);
    if (off.distanceToSquared(offObj) > 1e-9) sigue = true;
    const g = giro;
    giro += (giroObj - giro) * k;
    if (Math.abs(giroObj - giro) > 1e-4) sigue = true;
    if (actual !== null && Math.abs(g - giro) > 1e-5) {
      grupos[actual].rotation.y = giro;
      if (++cuentaGiro % 4 === 0 || Math.abs(giroObj - giro) <= 1e-4) sombrasSucias = true;
    }

    const ke = 1 - Math.exp(-dt * 9);
    const acento = densidad === 'sobria' ? ACENTO_SOBRIO : ACENTO;
    for (let i = 0; i < n; i++) {
      const v = encendido[i] + (objetivo[i] - encendido[i]) * (reducido() ? 1 : ke);
      if (Math.abs(objetivo[i] - v) > 0.002) sigue = true;
      encendido[i] = Math.abs(objetivo[i] - v) <= 0.002 ? objetivo[i] : v;
      const e = encendido[i];
      const sobria = densidad === 'sobria';
      cantos[i].material.color.copy(CANTO).lerp(sobria ? ACENTO_SOBRIO : CANTO_ENCENDIDO, e);
      halos[i].material.color.copy(sobria ? ACENTO_SOBRIO : ACENTO);
      halos[i].material.opacity = e * (sobria ? 0.25 : 0.85);
      baldas[i].material.emissive.copy(acento);
      baldas[i].material.emissiveIntensity = e * (sobria ? 1.2 : 5);
      brillos[i].material.color.copy(acento);
      brillos[i].material.opacity = e * (sobria ? 0.12 : 0.45);
    }

    camera.position.copy(base.pos).add(off);
    camera.lookAt(tmp.copy(base.mira).addScaledVector(off, 0.35));
    if (!anim) aplicarPendientes();
    pintar();
    emitirRects();
    seguido = sigue;
    if (sigue) despertar();
  }
  const tmpColor = new THREE.Color();
  function pintar() {
    if (sombrasSucias) { renderer.shadowMap.needsUpdate = true; sombrasSucias = false; }
    renderer.render(scene, camera);
  }

  /* Rectángulos en pantalla de cada hueco (balda + zapatilla), para los botones de app.js. */
  const esquinas = Array.from({ length: 8 }, () => new V());
  function rectDe(i, w, h) {
    const { x, y } = bahia(i);
    const alto = medidas[productos[i].slug]?.alto ?? 0.15;
    const xs = [x - ANCHO_BALDA / 2, x + ANCHO_BALDA / 2], ys = [y - GROSOR - 0.01, y + alto + 0.01], zs = [0, FONDO];
    let k = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const a of xs) for (const b of ys) for (const c of zs) {
      const p = esquinas[k++].set(a, b, c).project(camera);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function emitirRects() {
    if (!alRects) return;
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    alRects(Array.from({ length: n }, (_, i) => rectDe(i, w, h)));
  }

  /* ---------- Tamaño ---------- */
  function ajustar() {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const e = modo === 'foco' ? encuadreFoco(actual) : encuadrePared();
    anim = null; base.pos.copy(e.pos); base.mira.copy(e.mira);
    despertar();
  }
  const ro = new ResizeObserver(ajustar);
  ro.observe(lienzo);
  ajustar();

  /* ---------- Modelos ---------- */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const detalle = new Map();     // i → promesa del modelo de zoom
  let cargadas = 0;

  function preparar(raiz) {
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { m.envMapIntensity = 0.85; }
    });
    return raiz;
  }
  function soltar(raiz) {
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
    });
  }
  function colocar(i, raiz) {
    const g = grupos[i];
    for (const c of [...g.children]) { g.remove(c); soltar(c); }
    g.add(raiz);
    sombrasSucias = true;
    despertar();
  }
  /* Antes de enseñar un modelo: compilar sus sombreadores sin bloquear y subir sus texturas
     de una en una, un fotograma cada una. Así no hay tirón cuando aparece. */
  const fotograma = () => new Promise((r) => requestAnimationFrame(r));
  let cola = Promise.resolve();
  function listoParaPintar(raiz) {
    const tarea = cola.then(async () => {
      try { await renderer.compileAsync(raiz, camera, scene); } catch {}
      const texturas = new Set();
      raiz.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) for (const v of Object.values(m)) if (v && v.isTexture) texturas.add(v); });
      for (const t of texturas) { renderer.initTexture(t); await fotograma(); }
      return raiz;
    });
    cola = tarea.catch(() => {});
    return tarea;
  }
  // El cambio a la versión de zoom espera a que la cámara se pare.
  const pendientes = new Map();
  let conDetalle = new Set();
  function aplicarPendientes() {
    for (const [i, raiz] of pendientes) { colocar(i, raiz); conDetalle.add(i); pendientes.delete(i); }
  }
  function cargarDetalle(i) {
    if (!detalle.has(i)) {
      detalle.set(i, loader.loadAsync(`modelos/${productos[i].slug}.glb`)
        .then((gltf) => listoParaPintar(preparar(gltf.scene)))
        .then((raiz) => { pendientes.set(i, raiz); despertar(); return true; })
        .catch(() => false));
    }
    return detalle.get(i);
  }
  // Las de pared primero, cada una «se enciende» al llegar.
  const pared$ = productos.map((p, i) => loader.loadAsync(`modelos/${p.slug}-pared.glb`)
    .then((gltf) => listoParaPintar(preparar(gltf.scene)))
    .then((raiz) => {
      if (conDetalle.has(i) || pendientes.has(i)) { soltar(raiz); return; }   // ya está la buena
      colocar(i, raiz);
      pulso(i);
    }).catch(() => {}).finally(() => { cargadas++; alProgreso?.(cargadas, n); }));

  function pulso(i) {
    if (reducido()) return;
    encendido[i] = 0.45;  // destello breve del canto al llegar su zapatilla
    despertar();
  }
  // Las de zoom no se bajan todas: solo la que señalas (antes de pulsarla) y las vecinas de la abierta.
  let esperaDetalle = 0;
  Promise.all(pared$).then(() => cola).then(() => { medirDesde = performance.now() + 1000; });

  /* ---------- Contacto con fallos del contexto ---------- */
  let alPerder = null;
  lienzo.addEventListener('webglcontextlost', (e) => { e.preventDefault(); alPerder?.(); });

  /* ---------- API para app.js ---------- */
  return {
    listo: Promise.all(pared$),
    resaltar(i) {
      objetivo.fill(0);
      if (modo === 'foco' && actual !== null) objetivo[actual] = 1;
      clearTimeout(esperaDetalle);
      if (i !== null && i !== undefined) {
        objetivo[i] = 1;
        esperaDetalle = setTimeout(() => cargarDetalle(i), 250);
      }
      despertar();
    },
    enfocar(i) {
      const antes = modo === 'foco' ? actual : null;
      if (antes !== null && antes !== i) { grupos[antes].rotation.y = 0; sombrasSucias = true; }
      giro = 0; giroObj = 0;
      if (i === null) {
        modo = 'pared'; actual = null;
        objetivo.fill(0);
        ir(encuadrePared(), 1100, 0);
        return;
      }
      modo = 'foco'; actual = i;
      objetivo.fill(0); objetivo[i] = 1;
      cargarDetalle(i).then(() => { if (actual === i && !movil) { cargarDetalle((i + 1) % n); cargarDetalle((i + n - 1) % n); } });
      // De la pared a una zapatilla: acercarse. De una a otra: recorrer la pared, separándose un poco.
      if (antes === null) ir(encuadreFoco(i), 1250, 0);
      else ir(encuadreFoco(i), 900 + 120 * Math.min(4, Math.abs(i - antes)), 0.12);
    },
    puntero(nx, ny) {
      if (densidad === 'sobria') { offObj.set(0, 0, 0); giroObj = 0; despertar(); return; }
      const amp = modo === 'foco' ? 0.018 : 0.05;
      offObj.set(nx * amp, -ny * amp * 0.6, 0);
      giroObj = modo === 'foco' ? nx * 0.28 : 0;
      despertar();
    },
    arrastrar(dxPx) {
      if (modo !== 'pared' || !vertical()) return;
      const visW = 2 * base.pos.z * T * aspecto();
      const d = -dxPx / lienzo.clientWidth * visW;
      panX += d; arrastrando = true;
      panV = d / 0.016;
      despertar();
    },
    soltarArrastre() { arrastrando = false; despertar(); },
    densidad(d) {
      densidad = d;
      if (d === 'sobria') { offObj.set(0, 0, 0); giroObj = 0; }
      despertar();
    },
    alPerderContexto(f) { alPerder = f; },
    async captura() {
      await Promise.all(productos.map((_, i) => cargarDetalle(i)));
      aplicarPendientes();
      const W = 4000, H = 2000;
      const dpr = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      const e = encuadrePared();
      objetivo.fill(0); encendido.fill(0);
      for (let i = 0; i < n; i++) { cantos[i].material.color.copy(CANTO); halos[i].material.opacity = 0; baldas[i].material.emissiveIntensity = 0; brillos[i].material.opacity = 0; }
      camera.position.copy(e.pos); camera.lookAt(e.mira);
      sombrasSucias = true;
      pintar();
      const blob = await new Promise((r) => lienzo.toBlob(r, 'image/png'));
      const zonas = Array.from({ length: n }, (_, i) => {
        const r = rectDe(i, W, H);
        return { slug: productos[i].slug, x: +(r.x / W).toFixed(5), y: +(r.y / H).toFixed(5), w: +(r.w / W).toFixed(5), h: +(r.h / H).toFixed(5) };
      });
      renderer.setPixelRatio(dpr);
      ajustar();
      return { blob, datos: { ancho: W, alto: H, zonas } };
    },
  };
}

/* Yeso: ruido fino + manchas suaves, en mosaico. */
function texturaYeso() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  // Manchas: rejilla de 32 con interpolación que da la vuelta (mosaico sin costuras).
  const G = 32, rej = new Float32Array(G * G).map(() => Math.random());
  const at = (x, y) => rej[((y + G) % G) * G + ((x + G) % G)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const gx = (x / S) * G, gy = (y / S) * G, x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    const v = (a + (b - a) * sy) * 0.55 + Math.random() * 0.45;
    const o = (y * S + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* Reflejo de la balda en la pared: elipse que se apaga hacia todos los bordes
   (el plano la estira); más fuerte un poco por encima del centro, a la altura del canto. */
function texturaBrillo() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 110, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Halo del canto encendido: barra con los extremos redondeados y un difuminado alrededor. */
function texturaHalo() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.roundRect(34, 22, 444, 20, 10); ctx.fill();
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';   // suave: el halo se suma al tubo y lo blanquearía
  ctx.beginPath(); ctx.roundRect(46, 28, 420, 8, 4); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
