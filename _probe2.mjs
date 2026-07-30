import { createServer } from 'vite';
import path from 'node:path';
const ROOT = '/home/user/nancy-';
const server = await createServer({ root: ROOT, configFile: path.join(ROOT,'vite.config.ts'), server:{middlewareMode:true}, logLevel:'error', optimizeDeps:{noDiscovery:true,include:[]} });
try {
  const mod = await server.ssrLoadModule('/_probe-content.ts');
  const c = mod.buildContent();
  const cond = (x) => {
    if (!x) return '';
    switch (x.kind) {
      case 'act': return `act${x.min??''}-${x.max??''}`;
      case 'all': return x.of.map(cond).join('&');
      case 'any': return '('+x.of.map(cond).join('|')+')';
      case 'not': return '!'+cond(x.of);
      case 'hasItem': return `+i:${x.item}`;
      case 'lacksItem': return `-i:${x.item}`;
      case 'hasClue': return `+c:${x.clue}`;
      case 'lacksClue': return `-c:${x.clue}`;
      case 'flag': return `f:${x.flag}=${x.value!==false}`;
      case 'puzzleSolved': return `S:${x.puzzle}`;
      case 'puzzleUnsolved': return `U:${x.puzzle}`;
      case 'visited': return `v:${x.scene}`;
      default: return x.kind;
    }
  };
  function* walk(effs, g=[]) {
    for (const e of effs ?? []) {
      yield [e, g];
      if (e.kind==='if') { yield* walk(e.then,[...g,cond(e.cond)]); yield* walk(e.else,[...g,'!'+cond(e.cond)]); }
      else if (e.kind==='sequence') yield* walk(e.of,g);
    }
  }
  const interesting = new Set(['giveItem','giveClue','goto','openPuzzle','talk','setAct','unlockScene','setFlag','endGame']);
  const only = process.argv.slice(2);
  for (const s of Object.values(c.scenes)) {
    if (only.length && !only.includes(s.id)) continue;
    console.log(`\n### ${s.id}  enterIf=${cond(s.enterIf)||'-'}`);
    const dump = (effs, tag) => {
      for (const [e,g] of walk(effs)) {
        if (!interesting.has(e.kind)) continue;
        const v = e.item ?? e.clue ?? e.scene ?? e.puzzle ?? e.character ?? e.act ?? e.flag ?? e.ending?.slice(0,30);
        console.log(`    ${tag} ${e.kind} ${v} ${g.length?'{'+g.join(' & ')+'}':''}`);
      }
    };
    if (s.onEnter) dump(s.onEnter,'onEnter:');
    if (s.onFirstEnter) dump(s.onFirstEnter,'onFirstEnter:');
    for (const h of s.hotspots) {
      const gates = [h.visibleIf?`vis=${cond(h.visibleIf)}`:'', h.enabledIf?`en=${cond(h.enabledIf)}`:''].filter(Boolean).join(' ');
      console.log(`  - ${h.id} "${h.label}" ${gates}`);
      dump(h.onInteract,'');
      for (const a of h.accepts ?? []) dump(a.effects, `accepts:${a.item}`);
    }
  }
} finally { await server.close(); }
