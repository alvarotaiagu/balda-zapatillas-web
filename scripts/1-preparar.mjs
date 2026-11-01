// Fase 1: glTF original → GLB común (metal-rugosidad, sin jerarquía, simplificado, WebP 2048) + nube de puntos coloreada
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough, flatten, clearNodeTransform, join, weld, simplify, dedup, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';

const SRC = process.argv[2], OUT = process.argv[3];
const LISTA = { f9ce175b: 'fila', fa6b5937: 'asics', '0938bb5f': 'pegasus-trail', '457569d4': 'reebok-nano', bc0d0141: 'racer-tr21',
  '05e79a2d': 'nb-997', bc791439: 'converse', c072600d: 'ozweego', '5f824154': 'old-skool', '717a18bd': 'xt6' };
const solo = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

for (const uid of fs.readdirSync(SRC)) {
  const slug = LISTA[uid.slice(0, 8)]; if (!slug || (solo && solo !== slug)) continue;
  const doc = await io.read(path.join(SRC, uid, 'scene.gltf'));
  const root = doc.getRoot();
  await doc.transform(metalRough(), flatten());
  for (const n of root.listNodes()) if (n.getMesh()) clearNodeTransform(n);
  let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  const ratio = Math.min(1, 90000 / tris);
  await doc.transform(dedup(), join(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008 }), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 85 }));
  let tris2 = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris2 += p.getIndices().getCount() / 3;
  await io.write(path.join(OUT, slug + '.glb'), doc);

  // nube de puntos: xyz + rgb muestreado de la textura de color
  const pts = [];
  for (const node of root.listNodes()) { const mesh = node.getMesh(); if (!mesh) continue;
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0');
      const mat = p.getMaterial(); const tex = mat && mat.getBaseColorTexture(); const fac = mat ? mat.getBaseColorFactor() : [1,1,1,1];
      let img = null, W = 0, H = 0;
      if (tex && uv) { const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(512, 512, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); img = data; W = info.width; H = info.height; }
      const n = pos.getCount(), step = Math.max(1, Math.floor(n / 120000)); const a = [], t = [];
      for (let i = 0; i < n; i += step) { pos.getElement(i, a); let r = fac[0]*255, g = fac[1]*255, b = fac[2]*255;
        if (img) { uv.getElement(i, t); const x = Math.min(W-1, Math.max(0, Math.floor((t[0]-Math.floor(t[0]))*W))), y = Math.min(H-1, Math.max(0, Math.floor((t[1]-Math.floor(t[1]))*H))); const o = (y*W+x)*3; r = img[o]*fac[0]; g = img[o+1]*fac[1]; b = img[o+2]*fac[2]; }
        pts.push(a[0], a[1], a[2], r, g, b); }
    } }
  fs.writeFileSync(path.join(OUT, slug + '.pts'), Buffer.from(new Float32Array(pts).buffer));
  console.log(slug, 'tris', Math.round(tris/1000)+'k →', Math.round(tris2/1000)+'k', 'MB', (fs.statSync(path.join(OUT, slug + '.glb')).size/1e6).toFixed(1), 'meshes', root.listMeshes().length, 'mats', root.listMaterials().length);
}
