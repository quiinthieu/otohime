import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginFetch, stepFetch, arriveFetch, carryFetch, cancelFetch, releaseVelocity, consumeDragClick, FETCH_LIMIT_MS } from './kame-fetch.ts';

const source={x:100,y:160,width:200,height:160};
const viewport={x:1280,y:860};
const begin=()=>beginFetch(source,{x:600,y:300},{x:90000,y:-90000},viewport);
test('fetch bounds release velocity and proxy; invalid input fails closed',()=>{
  assert.ok(Math.hypot(...Object.values(releaseVelocity({x:0,y:0,time:0},{x:9000,y:-9000,time:1})))<=700.001);
  assert.deepEqual(releaseVelocity({x:0,y:0,time:10},{x:5,y:5,time:10}),{x:0,y:0});
  assert.throws(()=>beginFetch({...source,width:NaN},{x:1,y:2},{x:0,y:0},viewport));
  let s=begin(); for(let i=0;i<20;i++) s=stepFetch(s,50);
  assert.equal(s.phase,'seeking'); assert.ok(s.point.x>=36&&s.point.x<=1244); assert.ok(s.point.y>=32&&s.point.y<=828);
  assert.deepEqual(s.source,{x:200,y:240});
});
test('acceptance cannot prove arrival: actual geometry gates both legs and carrying',()=>{
  let s=stepFetch(begin(),180); assert.equal(s.phase,'seeking');
  assert.equal(arriveFetch(s,{x:0,y:0}).phase,'seeking');
  s=arriveFetch(s,s.point); assert.equal(s.phase,'returning');
  s=carryFetch(s,{x:400,y:300}); assert.deepEqual(s.point,{x:400,y:300});
  assert.equal(arriveFetch(s,{x:400,y:300}).phase,'returning');
  s=arriveFetch(s,s.source); assert.equal(s.phase,'returned'); assert.deepEqual(s.point,s.source);
  assert.equal(stepFetch(s,10000).phase,'returned');
});
test('five seconds active time cancels either leg; cancellation is terminal and reversible',()=>{
  const s=stepFetch(begin(),180);
  assert.equal(stepFetch(s,FETCH_LIMIT_MS-181).phase,'seeking');
  assert.equal(stepFetch(s,FETCH_LIMIT_MS-180).phase,'cancelled');
  const returning=arriveFetch(s,s.point);
  assert.equal(stepFetch(returning,FETCH_LIMIT_MS).phase,'cancelled');
  const cancelled=cancelFetch(returning); assert.equal(cancelled.phase,'cancelled'); assert.deepEqual(cancelled.point,cancelled.source);
  assert.equal(arriveFetch(cancelled,s.point).phase,'cancelled');
  assert.equal(stepFetch(s,NaN).elapsed,s.elapsed);
});
test('completed drag click token is exact-once, pointer-scoped and never swallows a later activation',()=>{
  const token={pointer:7,at:100,target:'grip'};
  const click={pointer:7,at:101,target:'grip',detail:1,modified:false};
  assert.deepEqual(consumeDragClick(token,click),{suppress:true,token:null});
  for(const other of [{pointer:8},{detail:0},{modified:true},{at:900},{target:'link'}]) {
    assert.deepEqual(consumeDragClick(token,{...click,...other}),{suppress:false,token:null});
  }
  assert.deepEqual(consumeDragClick(null,click),{suppress:false,token:null});
});

test('typed local port keeps acceptance separate from completion and tears down subscribers and receivers',async()=>{
  const {commandKame,bindKame,emitKameCompletion,subscribeKameCompletion}=await import('../components/kame/commands.ts');
  const events:string[]=[];const unsubscribe=subscribeKameCompletion(e=>events.push(`${e.id}:${e.type}`));
  assert.equal(commandKame({type:'fetch',id:'one',target:{x:1,y:2}}),false);
  const unbind=bindKame(()=>true);
  assert.equal(commandKame({type:'fetch',id:'one',target:{x:1,y:2}}),true);assert.deepEqual(events,[]);
  emitKameCompletion({type:'arrived',id:'one',position:{x:1,y:2}});assert.deepEqual(events,['one:arrived']);
  unsubscribe();emitKameCompletion({type:'cancelled',id:'one',position:{x:1,y:2}});assert.equal(events.length,1);
  unbind();assert.equal(commandKame({type:'cancel'}),false);
});
