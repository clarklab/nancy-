import { createServer } from 'vite';
import path from 'node:path';

const ROOT = '/home/user/nancy-';
const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  server: { middlewareMode: true },
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const mod = await server.ssrLoadModule('/_probe-content.ts');
  const content = mod.buildContent();
  const issues = mod.validateContent(content);
  const D = mod.DEBUG;
  const arg = process.argv[2] ?? 'reach';
  if (arg === 'reach') {
    for (const [act, set] of Object.entries(D.actReach)) {
      console.log(`ACT ${act} entry=${JSON.stringify(D.actEntry[act])}`);
      console.log(`  reach(${set.length}): ${set.join(' ')}`);
      const missing = Object.keys(content.scenes).filter((s) => !set.includes(s));
      console.log(`  NOT reachable: ${missing.join(' ')}`);
    }
  } else if (arg === 'grants') {
    const want = process.argv.slice(3);
    for (const g of D.grants) if (!want.length || want.includes(g.id)) console.log(g.kind, g.id, '->', g.hosts.join(','), '@', g.where);
  } else if (arg === 'issues') {
    for (const i of issues) console.log(i.severity, i.where, '|', i.message);
  } else if (arg === 'edges') {
    const act = process.argv[3];
    for (const [from, to] of Object.entries(D.actEdges[act])) console.log(from, '->', to.join(' '));
  } else if (arg === 'required') {
    console.log(D.required.join('\n'));
  }
} finally { await server.close(); }
