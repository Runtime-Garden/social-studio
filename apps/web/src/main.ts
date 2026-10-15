/**
 * P2 slice 2: web entry point (`npm run serve:web` after `build:web`).
 */
import { startServer } from './server.js';

const server = await startServer();
console.log(`[rgstudio-web] listening on ${server.url} (database: ${server.config.dbPath})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.close().then(() => {
      process.exit(0);
    });
  });
}
