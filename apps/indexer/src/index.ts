import pino from 'pino';

const log = pino({ name: 'indexer' });

async function main() {
  log.info('Indexer arrancando...');
  // TODO: conectar a Postgres + Redis
  // TODO: suscribirse a eventos: Transfer, OrderCreated, TradeExecuted, IdentityRegistered
  // TODO: mantener cap_table y orders en sync con on-chain
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
