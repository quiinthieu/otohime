/** Shared paper gesture vocabulary. Browser adapters own capture/listener lifetimes. */
export type Gesture = "idle" | "peel" | "hold" | "fetch" | "crumple";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface TactileOptions { clock: () => number; storage?: StoragePort; seed: number }
export interface Surface { id: string; tossable: boolean; excluded: boolean; margin: string; fetchOnly?: boolean }
export interface PointerStart { pointer: number; x: number; y: number; intent: "peel" | "body" | "grip"; touch?: boolean; blocked?: boolean }
export interface GesturePort {
  readonly state: Gesture;
  readonly pointer: number | null;
  start(input: PointerStart): boolean;
  move(pointer: number, x: number, y: number): Gesture;
  tick(): Gesture;
  end(pointer: number): Gesture;
  cancel(): void;
}
export interface RouteSession {
  seed(id: string): number;
  peeled(id: string): boolean;
  set(id: string, peeled: boolean): void;
  depart(): void;
}
export function stableSurfaceId(kind: "project" | "note", key: string): string {
  return `${kind}:${encodeURIComponent(key.trim())}`;
}
export function eligibleRoute(route: string): boolean {
  return route === "/projects" || route === "/notes";
}
export function discoverSurfaces(route: string, surfaces: Surface[]): Surface[] {
  if (!eligibleRoute(route)) return [];
  const seen = new Set<string>();
  return surfaces.filter(s => {
    if (!s.id || s.id.length > 256 || !s.tossable || s.excluded || (!s.margin.trim() && s.fetchOnly !== true) || seen.has(s.id)) return false;
    seen.add(s.id); return true;
  }).slice(0, 128).map(s => ({...s, margin:s.margin.trim().slice(0,160)}));
}
export function createGesture({clock}: Pick<TactileOptions, "clock">): GesturePort {
  let state: Gesture="idle", owner: PointerStart | null=null, started=0;
  const cancel=()=>{state="idle";owner=null;};
  return {
    get state(){return state;}, get pointer(){return owner?.pointer ?? null;},
    start(input) {
      if(owner || input.blocked) return false;
      owner={...input}; started=clock(); state=input.intent==="peel" ? "peel" : "hold"; return true;
    },
    move(pointer,x,y) {
      if(!owner || pointer!==owner.pointer || state!=="hold") return state;
      const distance=Math.hypot(x-owner.x,y-owner.y);
      if(owner.touch && owner.intent==="body") { if(distance>8) cancel(); }
      else if(distance>6) state="fetch";
      return state;
    },
    tick() { if(state==="hold" && clock()-started>=600) state="crumple"; return state; },
    end(pointer) {
      if(pointer!==owner?.pointer) return "idle";
      const result=state; cancel(); return result;
    }, cancel,
  };
}
function hash(value: string, seed: number): number {
  let n=seed>>>0;
  for(const c of value) n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
  return n;
}
export function createRouteSession(route: string, {storage,seed}: TactileOptions): RouteSession {
  const key=`paper:v1:${route}`;
  let ids=new Set<string>();
  const valid=(id: unknown): id is string => typeof id==="string" && id.length>0 && id.length<=256;
  try {
    const raw=storage?.getItem(key);
    if(raw && raw.length<=36000) {
      const parsed=JSON.parse(raw);
      if(parsed?.version===1 && Array.isArray(parsed.ids) && parsed.ids.length<=128 && parsed.ids.every(valid)) ids=new Set(parsed.ids);
      else storage=undefined;
    } else if(raw) storage=undefined;
  } catch {storage=undefined;}
  const persist=()=>{try {storage?.setItem(key,JSON.stringify({version:1,ids:[...ids]}));} catch {storage=undefined;}};
  return {
    seed:id=>hash(id,seed), peeled:id=>ids.has(id),
    set(id,peeled) {
      if(!valid(id)) return;
      if(peeled) {ids.delete(id);ids.add(id);if(ids.size>128) ids.delete(ids.values().next().value!);}
      else ids.delete(id);
      persist();
    },
    depart() {ids.clear();try {storage?.removeItem(key);} catch {storage=undefined;}},
  };
}
