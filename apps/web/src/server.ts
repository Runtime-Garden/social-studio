/**
 * P2 slice 2: server lifecycle.
 *
 * Opens the database, applies migrations, enforces the admin bootstrap rule
 * (an empty user table plus missing credentials is a hard startup error, not
 * a silently unprotected app), then listens. Returns a handle the tests and
 * main entry use; `close()` is idempotent and safe after a manual db.close().
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { openDatabase, type StudioDatabase } from '../../../packages/storage/src/db.js';
import { applyMigrations } from '../../../packages/storage/src/migrate.js';
import { countUsers, createUser } from '../../../packages/storage/src/repos/users.js';
import { hashPassword } from './auth/passwords.js';
import { loadConfig, type WebConfig } from './config.js';
import { createApp } from './createApp.js';

export interface StartedServer {
  url: string;
  port: number;
  db: StudioDatabase;
  config: WebConfig;
  app: Express;
  close(): Promise<void>;
}

export async function startServer(overrides: Partial<WebConfig> = {}): Promise<StartedServer> {
  const config: WebConfig = { ...loadConfig(), ...overrides };

  const db = openDatabase({ path: config.dbPath });
  applyMigrations(db, config.migrationsDir);

  if (countUsers(db) === 0) {
    if (!config.adminBootstrap) {
      db.close();
      throw new Error(
        'No users exist and no admin bootstrap credentials were provided ' +
          '(set RG_ADMIN_USERNAME and RG_ADMIN_PASSWORD for the first start)',
      );
    }
    createUser(db, {
      username: config.adminBootstrap.username,
      passwordHash: hashPassword(config.adminBootstrap.password),
    });
  }

  const app = createApp({ db, config });
  const httpServer = await new Promise<Server>((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => resolve(server));
    server.on('error', reject);
  });
  const address = httpServer.address() as AddressInfo;

  let closed = false;
  return {
    url: `http://${config.host}:${address.port}`,
    port: address.port,
    db,
    config,
    app,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
        httpServer.closeAllConnections();
      });
      try {
        db.close();
      } catch {
        // Already closed by the caller (e.g. the readiness-degradation test).
      }
    },
  };
}
