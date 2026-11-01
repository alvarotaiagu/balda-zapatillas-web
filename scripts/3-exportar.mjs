// Fase 2: orientar (punta a +X, arriba +Y, cara a la pared +Z), largo 0,30, suela en y=0; versión pared y versión zoom
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { transformMesh, getBounds, simplify, weld, prune, textureCompress, meshopt, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp'; import fs from 'fs'; import path from 'path';
const [WORK, OUT] = process.argv.slice(2);
const rot = JSON.parse(fs.readFileSync(path.join(WORK, 'rot.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const LARGO = 0.30, medidas = {};
for (const [slug, R] of Object.entries(rot)) {
  for (const version of ['zoom', 'pared']) {
    const doc = await io.read(path.join(WORK, slug + '.glb'));
    const root = doc.getRoot(); const scene = root.getDefaultScene() || root.listScenes()[0];
    const meshes = root.listMeshes();
    // rotación (filas de R = ejes nuevos) en matriz 4x4 por columnas
    const m = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1];
    for (const me of meshes) transformMesh(me, m);
    let b = getBounds(scene); const k = LARGO / (b.max[0] - b.min[0]);
    const cx = (b.max[0] + b.min[0]) / 2, cz = (b.max[2] + b.min[2]) / 2;
    const t = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -cx * k, -b.min[1] * k, -cz * k, 1];
    for (const me of meshes) transformMesh(me, t);
    b = getBounds(scene);
    medidas[slug] = { largo: +(b.max[0] - b.min[0]).toFixed(4), alto: +(b.max[1] - b.min[1]).toFixed(4), ancho: +(b.max[2] - b.min[2]).toFixed(4) };
    for (const mat of root.listMaterials()) { mat.setDoubleSided(true); }
    if (version === 'pared') {
      await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.002 }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80, slots: /baseColor/ }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80, slots: /^(?!baseColor)/ }));
    } else {
      await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 82, slots: /baseColor/ }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82, slots: /^(?!baseColor)/ }));
    }
    await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const f = path.join(OUT, version === 'pared' ? `${slug}-pared.glb` : `${slug}.glb`);
    await io.write(f, doc);
    let tris = 0; for (const me of root.listMeshes()) for (const p of me.listPrimitives()) tris += p.getIndices().getCount() / 3;
    console.log(slug.padEnd(14), version.padEnd(5), (fs.statSync(f).size / 1e6).toFixed(2), 'MB', Math.round(tris / 1000) + 'k tris');
  }
}
fs.writeFileSync(path.join(OUT, 'medidas.json'), JSON.stringify(medidas, null, 1));
