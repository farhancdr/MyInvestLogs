/**
 * Local API server.
 *
 * Runs on your machine only — no auth layer, because there is no network
 * surface beyond localhost and no second user.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, allSettings, setSetting, transaction } from './db/index.ts';
import { businesses } from './routes/businesses.ts';
import { investments } from './routes/investments.ts';
import { transactions } from './routes/transactions.ts';
import { insights } from './routes/insights.ts';
import { buildDashboard, portfolioMetrics } from './services/metrics.ts';
import { writeAudit } from './services/audit.ts';
import * as repo from './services/repo.ts';
import { handle } from './routes/helpers.ts';

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = join(here, '../../dist/client');

const app = new Hono();
const api = new Hono();

api.get('/dashboard', (c) => handle(c, () => buildDashboard()));
api.get('/metrics', (c) =>
  handle(c, () => portfolioMetrics(repo.listInvestments(), repo.listTransactions())),
);
api.get('/audit', (c) => handle(c, () => repo.recentAudit(200)));
api.get('/settings', (c) => handle(c, () => allSettings()));

api.patch('/settings/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json<{ value: unknown }>();

  return handle(c, () =>
    transaction(() => {
      setSetting(key, String(body.value));
      writeAudit('update', 'Setting', key, { value: body.value });
      return { key, value: String(body.value) };
    }),
  );
});

api.route('/businesses', businesses);
api.route('/investments', investments);
api.route('/transactions', transactions);
api.route('/', insights);

app.route('/api', api);

// In Docker one process serves the built client too; in dev Vite handles it.
if (existsSync(clientDir)) {
  app.use('/*', serveStatic({ root: clientDir }));
  app.get('*', serveStatic({ path: 'index.html', root: clientDir }));
}

const port = Number(process.env.PORT ?? 3000);

db(); // open and migrate before accepting requests

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`Investment Tracker API on http://localhost:${info.port}`);
});
