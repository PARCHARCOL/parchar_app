const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
test("world fauna are bounded true 3D models without image planes or external downloads",()=>{
 let total=0;
 for(const id of ["ciervo","zorro","unicornio"]){const b=fs.readFileSync(path.join(__dirname,"../public/assets/creative-world/fauna",id+".glb"));total+=b.length;assert.equal(b.toString("ascii",0,4),"glTF");const json=JSON.parse(b.toString("utf8",20,20+b.readUInt32LE(12)).trim());assert.ok(json.meshes.length>0);assert.equal(json.animations?.length||0,0);assert.equal(json.skins?.length||0,0);assert.ok(json.meshes.every(mesh=>mesh.primitives.every(p=>p.attributes.POSITION!=null&&p.attributes.COLOR_0!=null)));assert.ok((json.buffers||[]).every(buffer=>!buffer.uri));}
 assert.ok(total<900000);
 const source=fs.readFileSync(path.join(__dirname,"../src/creative-fauna.js"),"utf8");assert.doesNotMatch(source,/SpriteMaterial|setInterval|requestAnimationFrame/);assert.match(source,/GLTFLoader/);
});
