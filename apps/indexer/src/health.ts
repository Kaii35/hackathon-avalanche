import { createServer, type Server } from 'node:http';
import type { Logger } from './logger.js';

export function startHealthServer(port: number, logger: Logger): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ts: Date.now() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, () => logger.info({ port }, 'health server up'));
  return server;
}
