import assert from "node:assert/strict";
import { test } from "node:test";
import { actionsSide, createGesture, createRouteSession, discoverSurfaces, eligibleRoute, stableSurfaceId, type StoragePort } from "./tactile.ts";

function memory(): StoragePort {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k,v) => { map.set(k,v); }, removeItem: k => { map.delete(k); } };
}
test("explicit registry: stable ids survive ordering, duplicates and unsafe surfaces are rejected", () => {
  const id = stableSurfaceId("project", "/pond");
  assert.equal(id, stableSurfaceId("project", "/pond"));
  assert.notEqual(id, stableSurfaceId("note", "/pond"));
  const card = { id, tossable: true, excluded: false, margin: "A little wonder." };
  assert.deepEqual(discoverSurfaces("/projects", [card, card, {...card, id:"unsafe", excluded:true}, {...card, id:"off", tossable:false}]), [card]);
  for (const path of ["/desk", "/account", "/admin", "/auth", "/login", "/projects/private", "/notes/private", "/play"]) {
    assert.equal(eligibleRoute(path), false, path);
    assert.deepEqual(discoverSurfaces(path, [card]), []);
  }
  assert.equal(eligibleRoute("/notes"), true);
});
test('fetch-only chips and stickers explicitly opt in without notes or peel eligibility',()=>{
  const chip={id:'line:mail',tossable:true,excluded:false,margin:'',fetchOnly:true};
  assert.deepEqual(discoverSurfaces('/notes',[chip]),[chip]);
  assert.deepEqual(discoverSurfaces('/notes',[{...chip,fetchOnly:false}]),[]);
  assert.deepEqual(discoverSurfaces('/desk',[chip]),[]);
  assert.deepEqual(discoverSurfaces('/projects',[{...chip,excluded:true}]),[]);
});
test("one pointer: peel owns movement and cannot become fetch or crumple", () => {
  let now = 0; const g = createGesture({clock:()=>now});
  assert.ok(g.start({pointer:1,x:0,y:0,intent:"peel"}));
  assert.equal(g.start({pointer:2,x:0,y:0,intent:"body"}), false);
  assert.equal(g.move(2,50,50), "peel");
  now=1000; assert.equal(g.tick(), "peel");
  assert.equal(g.move(1,50,50), "peel");
  assert.equal(g.end(2), "idle"); assert.equal(g.state,"peel");
  assert.equal(g.end(1), "peel"); assert.equal(g.state,"idle");
});
test("hold boundaries, scroll precedence and cancellation prohibit double completion", () => {
  let now=0; const g=createGesture({clock:()=>now});
  const start=(touch=false,intent: "body"|"grip"="body")=>g.start({pointer:1,x:0,y:0,intent,touch});
  start(); now=599; assert.equal(g.tick(),"hold"); now=600; assert.equal(g.tick(),"crumple");
  assert.equal(g.move(1,100,0),"crumple"); g.cancel(); assert.equal(g.pointer,null);
  start(); assert.equal(g.move(1,6,0),"hold"); assert.equal(g.move(1,6.01,0),"fetch");
  now+=700; assert.equal(g.tick(),"fetch"); g.cancel();
  start(true); assert.equal(g.move(1,8,0),"hold"); assert.equal(g.move(1,8.01,0),"idle");
  now+=700; assert.equal(g.tick(),"idle");
  start(true,"grip"); assert.equal(g.move(1,7,0),"fetch"); g.cancel();
  assert.equal(g.start({pointer:1,x:0,y:0,intent:"body",blocked:true}),false);
});
test("route session survives reload, clears only on departure, and bounds persisted ids", () => {
  const storage=memory(), options={clock:()=>123,storage,seed:42};
  const s=createRouteSession("/notes", options); s.set("note:a",true);
  assert.equal(createRouteSession("/notes",options).peeled("note:a"),true);
  assert.equal(createRouteSession("/projects",options).peeled("note:a"),false);
  assert.equal(s.seed("note:a"),createRouteSession("/notes",options).seed("note:a"));
  assert.notEqual(s.seed("note:a"),s.seed("note:b"));
  for(let i=0;i<200;i++) s.set(`note:${i}`,true);
  const reloaded=createRouteSession("/notes",options);
  assert.ok(Array.from({length:200},(_,i)=>reloaded.peeled(`note:${i}`)).filter(Boolean).length<=128);
  s.depart(); assert.equal(createRouteSession("/notes",options).peeled("note:a"),false);
});
test("throwing or malformed storage falls back to working memory", () => {
  for(const raw of ["bad", "{}", '{"version":1,"ids":[null]}', "x".repeat(20000)]) {
    const storage=memory(); storage.setItem("paper:v1:/notes",raw);
    const s=createRouteSession("/notes",{clock:()=>0,storage,seed:7});
    assert.equal(s.peeled("x"),false); s.set("x",true); assert.equal(s.peeled("x"),true); s.depart();
  }
  const blocked={getItem(){throw Error("blocked");},setItem(){throw Error("blocked");},removeItem(){throw Error("blocked");}};
  const s=createRouteSession("/notes",{clock:()=>0,storage:blocked,seed:7});
  s.set("x",true); assert.ok(s.peeled("x")); s.set("x",false); assert.equal(s.peeled("x"),false); s.depart();
});

test("storage failures after a successful read retain local state, including deletion", () => {
  let writes=0, removals=0;
  const storage: StoragePort={
    getItem:()=>'{"version":1,"ids":["note:saved"]}',
    setItem:()=>{writes++;throw Error('quota');},
    removeItem:()=>{removals++;throw Error('blocked');},
  };
  const s=createRouteSession('/notes',{clock:()=>0,storage,seed:259});
  assert.ok(s.peeled('note:saved'));
  s.set('note:new',true); s.set('note:saved',false);
  assert.equal(writes,1,'failed storage is abandoned');
  assert.ok(s.peeled('note:new')); assert.equal(s.peeled('note:saved'),false);
  s.depart(); assert.equal(s.peeled('note:new'),false);
  const fresh=createRouteSession('/notes',{clock:()=>0,storage,seed:259});
  fresh.depart(); assert.equal(removals,1); assert.equal(fresh.peeled('note:saved'),false);
});

test("registry and serialized session reject unbounded or invalid input", () => {
  const card={id:'note:a',tossable:true,excluded:false,margin:' x '.repeat(200)};
  assert.equal(discoverSurfaces('/notes',[card])[0].margin.length,160);
  assert.equal(discoverSurfaces('/notes',[{...card,id:'x'.repeat(257)},{...card,margin:'   '}]).length,0);
  assert.equal(discoverSurfaces('/notes',Array.from({length:200},(_,i)=>({...card,id:`note:${i}`}))).length,128);
  for(const raw of ['null','{"version":2,"ids":["note:a"]}',JSON.stringify({version:1,ids:['x'.repeat(257)]}),'x'.repeat(36001)]) {
    const storage=memory(); storage.setItem('paper:v1:/notes',raw);
    const session=createRouteSession('/notes',{clock:()=>0,storage,seed:259});
    assert.equal(session.peeled('note:a'),false); session.set('note:a',true); assert.ok(session.peeled('note:a'));
  }
});

test("hovered actions move above only while an open Peek fan covers them, then stay put", () => {
  const actions={left:200,top:300,right:320,bottom:344};
  assert.equal(actionsSide(null,actions,'below'),'below');
  assert.equal(actionsSide({left:100,top:280,right:560,bottom:440},actions,'below'),'above','fan below the pointer covers the actions');
  assert.equal(actionsSide({left:100,top:344,right:560,bottom:500},actions,'below'),'below','touching edges leave the button reachable');
  assert.equal(actionsSide({left:320,top:200,right:600,bottom:400},actions,'below'),'below');
  assert.equal(actionsSide(null,actions,'above'),'above','a closing fan never moves actions from under the pointer');
  for(const bad of [NaN,Infinity]) assert.equal(actionsSide({left:bad,top:0,right:1,bottom:1},actions,'below'),'below');
});
