import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const FAUNA_IDS = ["ciervo", "zorro", "unicornio"];
export function createFaunaKit(changed) {
  const loader = new GLTFLoader(), cache = new Map();
  let disposed = false;
  function release(model) { model.traverse((node) => { node.geometry?.dispose(); if (node.material) node.material.dispose(); }); }
  async function create(id) {
    if (!FAUNA_IDS.includes(id) || disposed) return null;
    if (!cache.has(id)) cache.set(id, loader.loadAsync(`/assets/creative-world/fauna/${id}.glb`).then((gltf) => {
      if (disposed) { release(gltf.scene); return null; }
      gltf.scene.traverse((node) => {
        if (!node.isMesh) return;
        const geo=node.geometry,normal=geo.attributes.normal,colors=geo.attributes.color;
        const accent=new THREE.Color(id==="ciervo"?"#83d8bf":id==="zorro"?"#f1b2ce":"#e4fff4"),color=new THREE.Color();
        for(let i=0;i<normal.count;i++){const light=.78+.22*Math.max(0,normal.getY(i)*.8-normal.getX(i)*.4+normal.getZ(i)*.2);color.setRGB(colors.getX(i),colors.getY(i),colors.getZ(i));if(color.r+color.g+color.b>.09)color.lerp(accent,.42);colors.setXYZ(i,color.r*light,color.g*light,color.b*light);}
        colors.needsUpdate=true;
      });
      return gltf.scene;
    }).catch(() => { cache.delete(id); return null; }));
    const template=await cache.get(id); if (!template || disposed) return null;
    const model=template.clone(true), group=new THREE.Group(); model.scale.setScalar(52);model.position.y=-26;group.add(model);
    // Fantasy ornaments are real geometry and remain visible from the side.
    if(id==="unicornio") { const horn=new THREE.Mesh(new THREE.ConeGeometry(1.8,13,8),new THREE.MeshBasicMaterial({color:"#b8ffe9"}));horn.position.set(-3,28.5,24);horn.isFaunaOrnament=true;group.add(horn); }
    if(id==="zorro"){
      const tails=[];for(let i=0;i<8;i++){const a=(i-3.5)*.21;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-7,-12),new THREE.Vector3(Math.sin(a)*12,-2,-29),new THREE.Vector3(Math.sin(a)*26,4+Math.cos(a)*9,-48)]);tails.push(new THREE.TubeGeometry(curve,5,1.5,5,false));}
      const geometry=mergeGeometries(tails);tails.forEach(g=>g.dispose());const plume=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:"#d7b6f7"}));plume.isFaunaOrnament=true;group.add(plume);
    }
    changed(); return group;
  }
  return {create,dispose(){disposed=true;for(const promise of cache.values())promise.then((model)=>{if(model)release(model);});cache.clear();}};
}
