import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function createDiscoveryKit({ keep, rockMaterial, materials }) {
  const stone = new THREE.IcosahedronGeometry(1, 2);
  const positions = stone.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const variation = 1 + .09 * Math.sin(x * 11 + y * 13 + z * 7);
    positions.setXYZ(i, x * 32 * variation, y * 25 * variation + 23, z * 25 * variation);
  }
  stone.computeVertexNormals(); keep(stone);
  const curves = [
    Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * 11, 30 + Math.cos(a) * 12, 22 + Math.sin(a) ** 2 * 2); }),
    [[-10, 16, 21], [0, 12, 24], [11, 16, 21]],
    [[-17, 25, 19], [-21, 31, 17], [-19, 37, 14]],
  ];
  const parts = curves.map((points) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => p.isVector3 ? p : new THREE.Vector3(...p))), 20, .65, 4, false));
  const inscription = mergeGeometries(parts); parts.forEach((geometry) => geometry.dispose());
  inscription.userData.fullLight = true; keep(inscription);
  const glow = new THREE.MeshBasicMaterial({ color: "#87f9dc" }); materials.push(glow);
  return {
    create(post) {
      const group = new THREE.Group(), body = new THREE.Mesh(stone, rockMaterial), rune = new THREE.Mesh(inscription, glow);
      const seed = [...String(post.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      group.rotation.y = (seed % 19) * .33; group.scale.set(1 + seed % 3 * .07, 1, .95 + seed % 5 * .025);
      group.add(body, rune); group.userData = { type: "post", id: post.id };
      group.traverse((node) => { node.userData = group.userData; });
      return group;
    },
  };
}
