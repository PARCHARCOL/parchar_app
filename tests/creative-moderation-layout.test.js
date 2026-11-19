const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
test("moderation overrides the 3D fullscreen scroll lock and uses current stylesheet",()=>{
 const css=fs.readFileSync(path.join(__dirname,"../public/creative.css"),"utf8"),html=fs.readFileSync(path.join(__dirname,"../public/creative-admin.html"),"utf8");
 assert.match(css,/\.creative-body\.wall-moderation\s*\{[^}]*height: auto;[^}]*overflow: auto;/);
 assert.match(html,/creative-admin\.css\?v=1/);assert.doesNotMatch(html,/maximum-scale|user-scalable=no|class="creative-body/);
});
test("moderation has an independent document layout and actions before the preview",()=>{
 const css=fs.readFileSync(path.join(__dirname,"../public/creative-admin.css"),"utf8"),js=fs.readFileSync(path.join(__dirname,"../public/creative-admin.js"),"utf8");
 assert.doesNotMatch(css,/overflow:\s*hidden|height:\s*100dvh|position:\s*fixed|touch-action:\s*none/);
 assert.match(css,/overflow-y:\s*auto/);assert.match(css,/max-height:\s*240px/);assert.match(js,/card\.prepend\(actions\)/);
});
