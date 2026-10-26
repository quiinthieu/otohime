"use client";

import { useEffect } from "react";
import { actionsSide, createGesture, createRouteSession, discoverSurfaces, type StoragePort } from "@/lib/tactile";
import { deckle, tearState } from "@/lib/tear";
import { createPaperFetch } from "./fetch";
import { bindPaperReset } from "./reset";

// Explicit roots, never a document-wide card/body gesture listener. Future toys use
// the same port but must opt in their own grips. Existing controls keep their input.
const EXCLUDED = 'a,button,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[data-tactile-exclude],.stamp-board,.stamp-heading,.desk-wrap,canvas';

export default function PaperLayer({ route }: { route: string }) {
  useEffect(() => {
    let storage: StoragePort | undefined;
    try { storage = window.sessionStorage; } catch {}
    const session = createRouteSession(route, { storage, clock: () => performance.now(), seed: 259 });
    const gesture = createGesture({ clock: () => performance.now() });
    let teardown = () => {};
    let restoreAll = () => {};

    const mount = () => {
      teardown();
      const events = new AbortController();
      const { signal } = events;
      const sticker = document.createElement('div');
      sticker.className = 'paper-sticker'; sticker.dataset.paperId = 'sticker:sea-star';
      sticker.dataset.tossable = 'true'; sticker.dataset.paperFetchOnly = 'true'; sticker.dataset.paperLabel = 'Sea star';
      const ink = document.createElement('span'); ink.textContent = '✳'; ink.setAttribute('aria-hidden', 'true'); sticker.append(ink);
      document.getElementById('kame-shell')?.append(sticker);
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-paper-id][data-tossable]')];
      const descriptors = nodes.map(el => ({
        id: el.dataset.paperId ?? "", tossable: el.dataset.tossable === "true",
        excluded: !!el.closest(EXCLUDED) || !!el.querySelector('input,textarea,select,[contenteditable]:not([contenteditable="false"]),canvas,.stamp-board,.desk-wrap'),
        margin: el.dataset.paperMargin ?? "", fetchOnly: el.dataset.paperFetchOnly === "true",
      }));
      const registry = discoverSurfaces(route, descriptors);
      const cleanups: (() => void)[] = [];
      const resets: (() => void)[] = [];
      const bars: [HTMLElement, HTMLElement][] = [];
      let cancelActive = () => {};
      // An open Peek fan covering a hovered card's actions moves them to its clear side.
      const avoidPeek=() => {
        const fan=document.querySelector('.peek-layer:not([data-state="closing"])')?.getBoundingClientRect() ?? null;
        if(fan) for(const [card,bar] of bars) {
          if(!card.matches(':hover')) continue;
          if(actionsSide(fan,bar.getBoundingClientRect(),card.dataset.paperActions==='above' ? 'above':'below')==='above') card.dataset.paperActions='above';
        }
      };
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const fetch = createPaperFetch(gesture, signal, motion);

      for (const surface of registry) {
        const el = nodes.find(n => n.dataset.paperId === surface.id)!;
        const root = document.createElement('div');
        root.dataset.paperControls = '';
        root.className = 'paper-tools';
        const corner = document.createElement('span'); corner.className = 'paper-corner'; corner.setAttribute('aria-hidden','true');
        const underneath = document.createElement('span'); underneath.className = 'paper-underlayer'; underneath.textContent = '✳';
        const flap = document.createElement('span'); flap.className = 'paper-flap';
        corner.append(underneath, flap);
        const margin = document.createElement('p'); margin.className = 'paper-margin'; margin.id = `margin-${surface.id}`;
        margin.textContent = surface.margin;
        const actions = document.createElement('div'); actions.className = 'paper-actions';
        const button = (label: string, className: string) => {
          const b=document.createElement('button'); b.type='button'; b.className=className; b.textContent=label; return b;
        };
        const handle=button('Drag corner','paper-handle'); handle.setAttribute('aria-label','Drag corner'); handle.title='Drag to peel the paper corner';
        const peel=button('Peel corner','paper-peel'); peel.setAttribute('aria-controls',margin.id);
        const reset=button('Reset','paper-reset');
        if (!surface.fetchOnly) { actions.append(peel,reset); root.append(corner,margin,handle); }
        else actions.append(reset);
        root.append(actions); el.append(root);
        fetch.attach(el, root, actions);
        if (!surface.fetchOnly) actions.append(margin);
        el.dataset.paperActive='true';
        bars.push([el,actions]);
        el.addEventListener('pointerenter',avoidPeek,{signal});
        el.addEventListener('pointerleave',()=>{delete el.dataset.paperActions;},{signal});
        let amount=session.peeled(surface.id) ? 1 : 0;
        let origin: {x:number;y:number;pointer:number} | null=null;
        let suppressClick=false;
        const paint=(value: number, state: string) => {
          amount=value; el.dataset.paperState=state;
          flap.style.clipPath=deckle(session.seed(surface.id),value);
          margin.hidden=value<0.25;
          peel.setAttribute('aria-expanded',String(!margin.hidden));
        };
        const release=() => {
          const pointer=origin?.pointer; origin=null;
          gesture.cancel();
          if(pointer!==undefined && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
        };
        const apply=(action: 'peel'|'reset'|'cancel', persist=true) => {
          release();
          const state=tearState(amount ? 'peeled':'intact',action);
          paint(state==='peeled'?1:0,state);
          if(persist) session.set(surface.id,state==='peeled');
        };
        paint(amount,amount ? 'peeled':'intact');
        resets.push(()=>apply('cancel'));
        peel.addEventListener('click',()=>{fetch.cancel();apply('peel');},{signal});
        reset.addEventListener('click',()=>{fetch.cancel();apply('reset');},{signal});
        handle.addEventListener('click',e=>{
          if(suppressClick && e.detail>0) {e.preventDefault();suppressClick=false;return;}
          apply('peel');
        },{signal});
        handle.addEventListener('pointerdown',e=>{
          if(e.button!==0 || !e.isPrimary || document.querySelector('[aria-modal="true"],dialog[open]')) return;
          if(!gesture.start({pointer:e.pointerId,x:e.clientX,y:e.clientY,intent:'peel'})) return;
          fetch.cancel();
          suppressClick=false;
          origin={x:e.clientX,y:e.clientY,pointer:e.pointerId};
          cancelActive=()=>{suppressClick=true;apply('cancel');};
          handle.setPointerCapture(e.pointerId);
          e.preventDefault();
        },{signal});
        handle.addEventListener('pointermove',e=>{
          if(origin?.pointer!==e.pointerId) return;
          const distance=Math.hypot(e.clientX-origin.x,e.clientY-origin.y);
          gesture.move(e.pointerId,e.clientX,e.clientY);
          if(distance>8) suppressClick=true;
          paint(motion.matches ? (distance>8?1:0) : Math.min(1,distance/64),'peeling');
        },{signal});
        handle.addEventListener('pointerup',e=>{
          if(origin?.pointer!==e.pointerId) return;
          const moved=suppressClick;
          apply(amount>=0.25 ? 'peel':'cancel');
          suppressClick=moved;
        },{signal});
        for(const type of ['pointercancel','lostpointercapture'] as const) handle.addEventListener(type,e=>{if(origin?.pointer===e.pointerId) cancelActive();},{signal});
        // Focusing original content restores its paper without removing or moving it.
        el.addEventListener('focusin',e=>{if(e.target instanceof Node && !root.contains(e.target)) apply('reset');},{signal});
        cleanups.push(()=>{release();root.remove();delete el.dataset.paperActive;delete el.dataset.paperState;delete el.dataset.paperActions;delete el.dataset.fetchState;});
      }
      const cancel=()=>{cancelActive();fetch.cancel();};
      const reset=()=>{cancel();for(const clear of resets) clear();};
      restoreAll=reset;
      const unbindReset=bindPaperReset(reset);
      document.addEventListener('keydown',e=>{if(e.key==='Escape') reset();},{signal});
      window.addEventListener('blur',cancel,{signal});
      window.addEventListener('resize',cancel,{signal});
      document.addEventListener('visibilitychange',()=>{if(document.hidden) cancel();},{signal});
      motion.addEventListener('change',cancel,{signal});
      const observer=new MutationObserver(()=>{
        if(nodes.some(n=>!n.isConnected)) {
          cancel();
          for(let i=nodes.length-1;i>=0;i--) if(!nodes[i].isConnected) nodes.splice(i,1);
        }
        if(document.querySelector('[aria-modal="true"],dialog[open]')) cancel();
        avoidPeek();
      });
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["open","aria-modal","data-side"]});
      teardown=()=>{events.abort();observer.disconnect();fetch.dispose();unbindReset();sticker.remove();for(const clean of cleanups) clean();gesture.cancel();teardown=()=>{};};
    };
    // Navigation API catches client hops, full-root links, history and location changes;
    // reload preserves this route's session. The fallback covers ordinary link departures.
    const life = new AbortController();
    const navigation = (window as Window & {navigation?: EventTarget}).navigation;
    navigation?.addEventListener('navigate',((event: Event & {destination?: {url: string};navigationType?: string})=>{
      if(event.destination && new URL(event.destination.url).pathname!==route) {restoreAll();session.depart();}
    }) as EventListener,{signal:life.signal});
    document.addEventListener('click',e=>{
      if(e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a=e.target instanceof Element ? e.target.closest('a[href]') : null;
      if(!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute('download')) return;
      const url=new URL(a.href);
      if(url.origin!==location.origin || url.pathname!==route) {restoreAll();session.depart();}
    },{signal:life.signal,capture:true});
    window.addEventListener('popstate',()=>{if(location.pathname!==route) {restoreAll();session.depart();}},{signal:life.signal});
    window.addEventListener('pagehide',()=>teardown(),{signal:life.signal});
    window.addEventListener('pageshow',()=>{if(window.location.pathname===route) mount();},{signal:life.signal});
    mount();
    return () => {
      life.abort(); teardown();
      // React can clean up the previous route before committing the new URL.
      // Reload/pagehide use their own teardown and preserve session state.
      session.depart();
    };
  }, [route]);
  return null;
}
