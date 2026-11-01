/* Balda: los diez pares de la pared y sus créditos.
   Orden: fila de arriba (0-4) y fila de abajo (5-9), de izquierda a derecha.
   Precios de ejemplo: la tienda es ficticia y la bolsa no cobra nada. */

const TALLAS = ['38', '39', '40', '41', '42', '43', '44', '45', '46'];
const tallas = (agotadas) => TALLAS.map((t) => ({ t, hay: !agotadas.includes(t) }));

export const PRODUCTOS = [
  { slug: 'fila', marca: 'FILA', modelo: 'Running', tipo: 'Running', color: 'Amarillo / azul', precio: 95, tallas: tallas(['38', '46']) },
  { slug: 'asics', marca: 'Asics', modelo: 'Trail', tipo: 'Trail', color: 'Marino / rosa', precio: 89, tallas: tallas(['44']) },
  { slug: 'pegasus-trail', marca: 'Nike', modelo: 'Pegasus Trail', tipo: 'Trail', color: 'Gris / naranja', precio: 139, tallas: tallas(['39', '45', '46']) },
  { slug: 'reebok-nano', marca: 'Reebok', modelo: 'Nano', tipo: 'Entrenamiento', color: 'Topo / rosa', precio: 129, tallas: tallas(['42']) },
  { slug: 'racer-tr21', marca: 'Adidas', modelo: 'Racer TR21', tipo: 'Diario', color: 'Leopardo / blanco', precio: 75, tallas: tallas(['38', '41']) },
  { slug: 'nb-997', marca: 'New Balance', modelo: '997', tipo: 'Clásica', color: 'Gris / blanco', precio: 179, tallas: tallas(['40', '46']) },
  { slug: 'converse', marca: 'Converse', modelo: 'Chuck Taylor Hi', tipo: 'Bota', color: 'Rojo', precio: 85, tallas: tallas([]) },
  { slug: 'ozweego', marca: 'Adidas', modelo: 'Ozweego', tipo: 'Diario', color: 'Negro / blanco', precio: 110, tallas: tallas(['43', '44']) },
  { slug: 'old-skool', marca: 'Vans', modelo: 'Old Skool', tipo: 'Skate', color: 'Verde / blanco', precio: 80, tallas: tallas(['39']) },
  { slug: 'xt6', marca: 'Salomon', modelo: 'XT-6', tipo: 'Trail', color: 'Gris perla', precio: 190, tallas: tallas(['38', '39', '45']) },
];

/* Modelos 3D: Sketchfab, licencia CC BY 4.0. Cambios: reorientados, escalados,
   simplificados y con las texturas comprimidas (WebP). */
export const CREDITOS = [
  { slug: 'fila', titulo: 'FILA Sneaker scan quarantine freebie', autor: 'mamasneakers', uid: 'f9ce175b20754bcd83eec7a21d694867' },
  { slug: 'asics', titulo: 'Asics Shoe', autor: 'terrielsimmons', uid: 'fa6b5937408441f7aa17d652998d1ae7' },
  { slug: 'pegasus-trail', titulo: 'Pegasus Trail', autor: 'matousekfoto', uid: '0938bb5f909f4070ae9281b3e37673f1' },
  { slug: 'reebok-nano', titulo: 'Reebok Crossfit Nano Shoe 3D Scan', autor: 'zdenkoroman', uid: '457569d486474185805135a3db42b95e' },
  { slug: 'racer-tr21', titulo: 'Adidas Racer TR21', autor: 'inciprocal.com', uid: 'bc0d0141da164d3c9f9fe71f6f340c9b' },
  { slug: 'nb-997', titulo: 'New Balance 997', autor: 'aizaisia', uid: '05e79a2dffbc4356bba7e0751fada08f' },
  { slug: 'converse', titulo: 'Converse — FREE', autor: 'yakaras', uid: 'bc791439d26f4dd9974819c168e12385' },
  { slug: 'ozweego', titulo: 'Adidas Ozweego', autor: 'dicorato.romain', uid: 'c072600d2c5a4fd29758d52ef5d0ae90' },
  { slug: 'old-skool', titulo: 'Vans Old Skool green', autor: 'thesidekick', uid: '5f8241541e7846af869b6bb0ceb72adf' },
  { slug: 'xt6', titulo: 'Salomon XT6 Sneaker Photo Scan', autor: 'renderedbyzhai', uid: '717a18bd58544842afbabc81523cda77' },
].map((c) => ({ ...c, url: `https://sketchfab.com/3d-models/${c.uid}`, autorUrl: `https://sketchfab.com/${encodeURIComponent(c.autor)}`, licencia: 'CC BY 4.0' }));

export const HDRI = { titulo: 'Studio Small 09', autor: 'Poly Haven', url: 'https://polyhaven.com/a/studio_small_09', licencia: 'CC0' };
