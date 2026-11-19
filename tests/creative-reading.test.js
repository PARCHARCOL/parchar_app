const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const space = require("../public/creative-space");
test("nearby reading works independently of facing direction and prioritizes undiscovered posts", () => {
  const posts=[{id:"near",x:0,y:0},{id:"behind",x:0,y:800},{id:"far",x:5000,y:0}];
  assert.deepEqual(space.readablePosts(posts,160,505).map(p=>p.id),["near","behind"]);
  assert.deepEqual(space.readablePosts(posts,160,505,new Set(["near"])).map(p=>p.id),["behind","near"]);
  assert.deepEqual(space.readablePosts(posts,160,505,new Set(),"near").map(p=>p.id),["behind"]);
  assert.deepEqual(space.readablePosts(posts,90000,90000),[]);
  assert.equal(space.readablePosts([{id:"edge",x:650,y:0}],160,165).length,1);
});
test("world discoveries use shared natural geometry rather than paragraph billboards", () => {
  const world=fs.readFileSync(path.join(__dirname,"../src/creative-world-3d.js"),"utf8");
  const discovery=fs.readFileSync(path.join(__dirname,"../src/creative-discoveries.js"),"utf8");
  assert.doesNotMatch(world,/signTexture|PlaneGeometry\(124, 91\)/);
  assert.match(discovery,/IcosahedronGeometry/);assert.match(discovery,/TubeGeometry/);assert.doesNotMatch(discovery,/fillText|CanvasTexture|setInterval/);
});
test("horizontal water has its own world-scaled ripples instead of a stretched waterfall map",()=>{
  const river=fs.readFileSync(path.join(__dirname,"../src/creative-river.js"),"utf8");
  assert.match(river,/RepeatWrapping/);assert.match(river,/uvs.push\(x \/ 100, z \/ 100\)/);assert.doesNotMatch(river,/waterfall-flow|requestAnimationFrame|setInterval/);
});
