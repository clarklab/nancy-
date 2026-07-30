import { createServer } from 'vite';
import path from 'node:path';
const ROOT='/home/user/nancy-';
const server=await createServer({root:ROOT,configFile:path.join(ROOT,'vite.config.ts'),server:{middlewareMode:true},logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]}});
try{
const mod=await server.ssrLoadModule('/_probe-content.ts');
const c=mod.buildContent();
function* walkC(x){ if(!x) return; yield x; if(x.kind==='all'||x.kind==='any') for(const y of x.of) yield* walkC(y); else if(x.kind==='not') yield* walkC(x.of); }
function* walk(effs,g=[]){ for(const e of effs??[]){ yield [e,g];
  if(e.kind==='if'){ yield* walk(e.then,[...g,{c:e.cond,neg:false}]); yield* walk(e.else,[...g,{c:e.cond,neg:true}]); }
  else if(e.kind==='sequence') yield* walk(e.of,g); } }
// index: what each site grants
const sites=[];
for(const s of Object.values(c.scenes)){
  for(const h of s.hotspots) sites.push({tag:`${s.id}/${h.id}`, effs:h.onInteract});
  if(s.onEnter) sites.push({tag:`${s.id}.onEnter`,effs:s.onEnter});
  if(s.onFirstEnter) sites.push({tag:`${s.id}.onFirstEnter`,effs:s.onFirstEnter});
}
for(const p of Object.values(c.puzzles)) sites.push({tag:`puzzle:${p.id}`,effs:p.onSolve});
const walkNodes=(ns,pre)=>{for(const n of ns){ if(n.effects) sites.push({tag:`${pre}/${n.id}`,effs:n.effects}); if(n.children) walkNodes(n.children,`${pre}/${n.id}`);} };
for(const t of c.dialogue) walkNodes(t.nodes,`dlg:${t.characterId}@${t.act}`);
const grantSites=new Map(); // id -> Set(tag)
for(const s of sites) for(const [e] of walk(s.effs)){
  const id = e.kind==='giveItem'? e.item : e.kind==='giveClue'? e.clue : null;
  if(id){ if(!grantSites.has(id)) grantSites.set(id,new Set()); grantSites.get(id).add(s.tag); }
}
console.log('=== grants gated on lacking an UNRELATED item/clue (ordering hazards) ===');
for(const s of sites) for(const [e,g] of walk(s.effs)){
  const id = e.kind==='giveItem'? e.item : e.kind==='giveClue'? e.clue : null;
  if(!id) continue;
  const sameSite = grantSites.get(id);
  for(const gg of g){
    for(const k of walkC(gg.c)){
      const positive = (k.kind==='lacksItem'||k.kind==='lacksClue') ? !gg.neg : (k.kind==='hasItem'||k.kind==='hasClue') ? gg.neg : null;
      if(positive!==true) continue;
      const blocker = k.item ?? k.clue;
      if(blocker===id) continue; // self-guard, fine
      // is the blocker granted by any site OTHER than this one?
      const others=[...(grantSites.get(blocker)??[])].filter(t=>t!==s.tag);
      if(others.length) console.log(`  ${s.tag}: grants ${id} only while LACKING ${blocker} — which is also granted elsewhere: ${others.join(', ')}`);
    }
  }
}
}finally{await server.close();}
