import * as THREE from "three";

export function createRiver(space) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#247e91"; ctx.fillRect(0, 0, 256, 256);
  const hash = window.CreativeTerrain.hash;
  for (let i = 0; i < 1100; i++) {
    const x = hash(i, 0, 718) * 256, y = hash(i, 0, 719) * 256;
    ctx.strokeStyle = i % 3 ? "#8ed9d733" : "#073d5c44"; ctx.lineWidth = .5 + hash(i, 0, 720) * 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, 2 + hash(i, 0, 721) * 8, 1 + hash(i, 0, 722) * 3, hash(i, 0, 723) * 6, 0, Math.PI * 1.2); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const positions = [], uvs = [], indices = [], rows = 120, columns = 4;
  for (let row = 0; row <= rows; row++) {
    const z = -15 + row * 2415 / rows, river = space.river(z);
    for (let col = 0; col <= columns; col++) {
      const across = col / columns * 2 - 1;
      const bank = .88 + .05 * Math.sin(z * .037 + (across < 0 ? 1 : 4));
      const x = river.x + across * river.width * bank;
      positions.push(x, river.y + .15 * Math.sin(z * .08 + col), z); uvs.push(x / 100, z / 100);
      if (row < rows && col < columns) { const i = row * (columns + 1) + col; indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, dispose() { geometry.dispose(); texture.dispose(); material.dispose(); } };
}
