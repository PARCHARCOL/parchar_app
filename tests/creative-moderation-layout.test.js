const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
test("moderation overrides the 3D fullscreen scroll lock and uses current stylesheet",()=>{
 const css=fs.readFileSync(path.join(__dirname,"../public/creative.css"),"utf8"),html=fs.readFileSync(path.join(__dirname,"../public/creative-admin.html"),"utf8");
 assert.match(css,/\.creative-body\.wall-moderation\s*\{[^}]*height: auto;[^}]*overflow: auto;/);
 assert.match(html,/creative\.css\?v=6/);assert.doesNotMatch(html,/maximum-scale|user-scalable=no/);
});
