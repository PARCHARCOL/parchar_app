import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function loadTexture(url, changed) {
  let resolve;
  const ready = new Promise((yes) => { resolve = yes; });
  const texture = new THREE.TextureLoader().load(url, () => { resolve(); changed(); }, undefined, () => {
    // A decorative image failure must not discard a working 3D scene.
    const canvas=document.createElement("canvas");canvas.width=192;canvas.height=128;const ctx=canvas.getContext("2d");
    if(url.includes("foliage")){for(let i=0;i<6;i++){ctx.fillStyle=["#57cba3","#72e7ba","#48c8dc","#e39bea","#82d8b0","#c788e2"][i];ctx.beginPath();ctx.ellipse(i%3*64+32,Math.floor(i/3)*64+32,19,29,.25,0,Math.PI*2);ctx.fill();}}
    else{ctx.fillStyle=url.includes("waterfall")?"#7adee9":url.includes("rock")?"#568579":"#628b70";ctx.fillRect(0,0,192,128);}
    texture.image=canvas;texture.needsUpdate=true;resolve();changed();
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, ready };
}

export function createForestKit({ keep, batch, material, materials, set, random, changed }) {
  const atlasAsset = loadTexture("/assets/creative-world/forest-foliage-v1.webp", changed), atlas = atlasAsset.texture;
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 2;
  const foliage = new THREE.MeshBasicMaterial({ map: atlas, color: "#ffffff", alphaTest: .38, side: THREE.DoubleSide, vertexColors: true }); materials.push(foliage);
  function leaf(tile, curl = .32) {
    const positions = [], uv = [], indices = [], columns = 1, rows = 6;
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
      const u = col / columns, v = row / rows;
      positions.push((u - .5) * (1 + .1 * Math.sin(v * Math.PI)), v, curl * v * v + .08 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI));
      uv.push((tile % 3 + .035 + u * .93) / 3, 1 - (Math.floor(tile / 3) + 1) / 2 + (.035 + v * .93) / 2);
      if (row < rows && col < columns) { const i = row * (columns + 1) + col; indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setAttribute("color", new THREE.Float32BufferAttribute(Array(positions.length).fill(1), 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.userData.fullLight = true; return keep(geometry);
  }
  function curve(points, radius, segments = 8) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, 5, false); }
  const parts = [curve([[0,0,0],[.025,.3,-.02],[-.02,.65,.03],[.02,1,0]], .035), curve([[0,.73,0],[-.1,.83,.02],[-.18,.94,.04]], .018, 4), curve([[.01,.8,0],[.12,.89,-.02],[.18,1,-.04]], .016, 4)];
  const trunkGeo = keep(mergeGeometries(parts)); parts.forEach((part) => part.dispose());
  const rootGeo = keep(curve([[0,.045,0],[.12,.02,.06],[.3,.01,.08],[.48,-.015,.06]], .018, 5));
  for (const geometry of [trunkGeo, rootGeo]) { const uv = geometry.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u); } }
  const barkAsset = loadTexture("/assets/creative-world/forest-bark-v1.webp", changed), barkMap = barkAsset.texture;
  const bark = material("#ffffff"); bark.map = barkMap;
  const trunks = batch(trunkGeo, bark, 320), roots = batch(rootGeo, bark, 960);
  const crowns = batch(leaf(0, .44), foliage, 1600), palms = batch(leaf(2, .38), foliage, 1600), ferns = batch(leaf(1, .28), foliage, 1600), purple = batch(leaf(5, .32), foliage, 960), blooms = batch(leaf(3, .2), foliage, 320);
  const color = new THREE.Color();
  const canopyCanvas=document.createElement("canvas");canopyCanvas.width=canopyCanvas.height=256;
  const canopyMap=new THREE.CanvasTexture(canopyCanvas);canopyMap.colorSpace=THREE.SRGBColorSpace;
  const canopyMaterial=material("#d0ffdc");canopyMaterial.map=canopyMap;canopyMaterial.alphaTest=.4;
  const lobes=[new THREE.SphereGeometry(1,8,5).scale(.34,.2,.3),new THREE.SphereGeometry(1,8,5).scale(.28,.2,.27).translate(-.25,.02,.02),new THREE.SphereGeometry(1,8,5).scale(.27,.24,.28).translate(.23,.04,-.03)];
  const canopyGeo=keep(mergeGeometries(lobes));lobes.forEach((geo)=>geo.dispose());const canopies=batch(canopyGeo,canopyMaterial,320);
  const paintCanopy=()=>{const ctx=canopyCanvas.getContext("2d");ctx.clearRect(0,0,256,256);if(atlas.image)for(let i=0;i<260;i++){ctx.save();ctx.translate(random(i,0,611)*256,random(i,0,612)*256);ctx.rotate(random(i,0,613)*6.28);const size=18+random(i,0,614)*26;ctx.drawImage(atlas.image,0,0,atlas.image.width/3,atlas.image.height/2,-size/2,-size/2,size,size);ctx.restore();}canopyMap.needsUpdate=true;changed();};
  canopyCanvas.getContext("2d").fillStyle="#28735b";canopyCanvas.getContext("2d").fillRect(0,0,256,256);atlasAsset.ready.then(paintCanopy);
  function update(plants, low) {
    let tree = 0, root = 0, crown = 0, palm = 0, fern = 0, violet = 0, flower = 0;
    for (const p of plants) {
      const sizes = window.CreativeSpace.dimensions(p), h = sizes.tree, leafSize = sizes.leaf;
      color.setHSL(.47 + p.hue * .08, .1, .9);
      if (p.kind === 0) {
        set(canopies,tree,p.x,p.y+h*.78,p.z,h,h,h,p.hue*6);
        set(trunks, tree++, p.x, p.y, p.z, h, h, h, p.hue * 6);
        for (let j = 0; j < 3; j++) set(roots, root++, p.x, p.y, p.z, h * .65, h * .4, h * .65, j * 2.094 + p.hue);
        const count = low ? 8 : 12;
        for (let j = 0; j < count; j++) {
          const angle = j * 2.399 + p.hue * 4;
          const y = p.y + h * (.74 + j % 3 * .095), x=p.x+Math.cos(angle)*h*.12,z=p.z+Math.sin(angle)*h*.12;
          if (j % 2) set(palms, palm++, x, y, z, leafSize, leafSize, leafSize * .6, angle, color, 1.05);
          else set(crowns, crown++, x, y, z, leafSize * .95, leafSize, leafSize * .6, angle, color, 1.05);
        }
        for (let j = 0; j < 2; j++) set(ferns, fern++, p.x + 20 * Math.cos(j * 3), p.y + 2, p.z + 20 * Math.sin(j * 3), sizes.fern, sizes.fern, sizes.fern * .6, j * 3 + p.hue, color, .65);
      } else if (p.kind === 1) {
        for (let j = 0; j < (low ? 3 : 4); j++) {
          const angle = j * 1.57 + p.hue * 6;
          set(p.hue > .65 ? purple : ferns, p.hue > .65 ? violet++ : fern++, p.x, p.y, p.z, sizes.fern, sizes.fern, sizes.fern * .6, angle, color, .65);
        }
      } else {
        for (let j = 0; j < 2; j++) set(blooms, flower++, p.x + j * 12, p.y + 2, p.z, sizes.flower, sizes.flower, sizes.flower * .7, p.hue * 6 + j * 2, color, .65);
      }
    }
    for (const [mesh, count] of [[canopies,tree],[trunks,tree],[roots,root],[crowns,crown],[palms,palm],[ferns,fern],[purple,violet],[blooms,flower]]) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.boundingSphere = null; }
  }
  return { bark, ready: Promise.all([atlasAsset.ready,barkAsset.ready]), update, dispose() { canopyMap.dispose();canopyMap.image=null;atlas.dispose(); atlas.image = null; barkMap.dispose(); barkMap.image = null; } };
}

export function createWaterfallKit({ keep, batch, material, materials, set, changed }) {
  const rockAsset = loadTexture("/assets/creative-world/forest-rock-v1.webp", changed), rockMap = rockAsset.texture;
  const rockMaterial = material("#ffffff"); rockMaterial.map = rockMap;
  const rockGeo = new THREE.IcosahedronGeometry(1, 2), rockPositions = rockGeo.attributes.position;
  for (let i = 0; i < rockPositions.count; i++) { const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i), factor = 1 + Math.sin(x * 12 + y * 7 + z * 11) * .08; rockPositions.setXYZ(i, x * factor, y * factor, z * factor); }
  rockGeo.computeVertexNormals();
  keep(rockGeo);
  const rocks = batch(rockGeo, rockMaterial, 15), stones = batch(keep(new THREE.IcosahedronGeometry(1,1)), rockMaterial, 60);
  const waterAsset = loadTexture("/assets/creative-world/waterfall-flow-v1.webp", changed), map = waterAsset.texture;
  const waterMaterial = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }); materials.push(waterMaterial);
  const geometry = new THREE.PlaneGeometry(1, 1, 4, 8);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) { const y = positions.getY(i); positions.setX(i, positions.getX(i) * (.75 + .2 * Math.cos(y * 7))); positions.setZ(i, Math.sin(y * 4) * .08); }
  geometry.computeVertexNormals();
  const poolMaterial = material("#ffffff"); poolMaterial.map = map;
  const falls = batch(keep(geometry), waterMaterial, 3), pools = batch(keep(new THREE.SphereGeometry(1, 12, 5)), poolMaterial, 3);
  function update(features, height) {
    let count = 0;
    for (const f of features) {
      const y = Math.max(3, height(f.x, f.z));
      for (let i = 0; i < 4; i++) set(rocks, count * 4 + i, f.x + (i % 2 ? 1 : -1) * f.width * .46, y + f.height * (.3 + i / 8), f.z - 20 - i * 7, f.width * .65, f.height * (.4 + i / 11), 50 + i * 8, i * .65);
      set(falls, count, f.x, y + f.height * .49, f.z + 30, f.width * .68, f.height * .94, 40, 0);
      set(pools, count, f.x, y + 3, f.z + 60, f.width * .85, 5, 85, 0);
      count++;
    }
    for (const [mesh, n] of [[rocks,count*4],[falls,count],[pools,count]]) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.boundingSphere = null; }
  }
  function groundRocks(points) {
    points.forEach((p,i) => set(stones,i,p.x,p.y+2,p.z,p.size*1.4,p.size*.7,p.size,p.hue*6));
    stones.count=points.length; stones.instanceMatrix.needsUpdate=true; stones.boundingSphere=null;
  }
  return { waterMaterial, groundRocks, ready: Promise.all([rockAsset.ready,waterAsset.ready]), update, dispose() { map.dispose(); map.image = null; rockMap.dispose(); rockMap.image = null; } };
}
