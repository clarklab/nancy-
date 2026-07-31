import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({
  root: '/home/user/nancy-', configFile: '/home/user/nancy-/vite.config.ts',
  server: { middlewareMode: true }, logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const m = await server.ssrLoadModule('/src/game/items.ts');
const items = Object.values(m.items).map(i => ({
  id: i.id, name: i.name, description: i.description, category: i.category ?? 'evidence',
}));
await writeFile('/home/user/nancy-/docs/design/items.json', JSON.stringify({ items }, null, 1));
console.log(items.length, 'items extracted');
await server.close();
