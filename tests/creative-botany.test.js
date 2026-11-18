const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('foliage atlas has six textured transparent species in a bounded download',async()=>{
  const sharp=require('sharp'),file=path.join(__dirname,'../public/assets/creative-world/forest-foliage-v1.webp');
  const metadata=await sharp(file).metadata();assert.equal(metadata.width,1152);assert.equal(metadata.height,768);assert.equal(metadata.hasAlpha,true);assert.ok(fs.statSync(file).size<450*1024);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){const stats=await sharp(file).extract({left:col*384,top:row*384,width:384,height:384}).stats();assert.equal(stats.channels[3].min,0);assert.ok(stats.channels[3].max>200);assert.ok(stats.channels.slice(0,3).some(c=>c.stdev>25));}
});
test('forest uses curved volume and instancing without loading a panoramic backdrop',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/creative-botany.js'),'utf8');
  assert.match(source,/TubeGeometry/);assert.match(source,/Float32BufferAttribute/);assert.match(source,/forest-foliage-v1/);assert.match(source,/alphaTest/);
  assert.doesNotMatch(source,/requestAnimationFrame|setInterval/);
});
test('water, bark and cliff use bounded detailed surface textures',async()=>{
  const sharp=require('sharp');
  for(const name of ['waterfall-flow-v1','forest-bark-v1','forest-rock-v1']){
    const file=path.join(__dirname,'../public/assets/creative-world',name+'.webp');
    const metadata=await sharp(file).metadata(),stats=await sharp(file).stats();
    assert.ok(metadata.width<=384&&metadata.height<=512);assert.ok(fs.statSync(file).size<100*1024);assert.ok(stats.channels.slice(0,3).some(c=>c.stdev>20));
  }
});
