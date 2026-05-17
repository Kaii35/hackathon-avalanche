import type { Candle } from '@/components/charts/TradingChart';

/**
 * Genera una serie OHLC determinística para una oferta.
 *
 * - Seed: derivada del offeringId, así la misma oferta produce siempre la
 *   misma gráfica (no flickea entre renders, no cambia al refresh).
 * - Modelo: random walk con drift suave + volatilidad creciente hacia el
 *   final para dar sensación de movimiento orgánico.
 * - Hasta que el indexer real emita TradeExecuted al stream, esto es el
 *   placeholder. Cuando se cablee, swap por la serie real agregada por
 *   timeframe.
 */
export function generateDummyCandles(
  offeringId: string,
  lastPrice: number,
  options: { days?: number; volatility?: number; startPrice?: number } = {},
): Candle[] {
  const days = options.days ?? 90;
  const baseVolatility = options.volatility ?? 0.025; // 2.5% diaria

  // Seed simple basado en el offeringId (hash determinístico).
  let seed = 0;
  for (let i = 0; i < offeringId.length; i++) {
    seed = (seed * 31 + offeringId.charCodeAt(i)) >>> 0;
  }
  const rand = mulberry32(seed);

  const candles: Candle[] = [];
  // Empezamos atrás en el tiempo, drift hacia lastPrice al final.
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  // Si la oferta tiene un precio "histórico" conocido (p.ej. SOLNOR antes
  // del re-pricing), úsalo como punto de partida del walk para que la curva
  // refleje la trayectoria real. Si no, fallback al rango 70%–110% del actual.
  let price =
    typeof options.startPrice === 'number' ? options.startPrice : lastPrice * (0.7 + rand() * 0.4);

  for (let i = 0; i < days; i++) {
    const time = now - (days - 1 - i) * dayMs;

    // Drift suave hacia lastPrice (más fuerte cerca del final).
    const driftStrength = 0.04 + (i / days) * 0.08;
    const driftTarget = lastPrice;
    const drift = (driftTarget - price) * driftStrength;

    // Volatility crece ligeramente hacia el final.
    const vol = baseVolatility * (1 + (i / days) * 0.4);
    const shock = (rand() - 0.5) * 2 * vol * price;

    const open = price;
    const close = Math.max(0.01, open + drift + shock);

    const intraSwing = Math.abs(close - open) + rand() * vol * price;
    const high = Math.max(open, close) + intraSwing * rand();
    const low = Math.max(0.01, Math.min(open, close) - intraSwing * rand());

    // Volumen correlacionado con magnitud del movimiento (mayor swing → más volumen).
    const baseVol = 1000 + rand() * 4000;
    const moveBoost = (Math.abs(close - open) / price) * 50000;
    const volume = Math.floor(baseVol + moveBoost);

    candles.push({ time, open, high, low, close, volume });

    price = close;
  }

  // Forzamos que la última vela cierre EXACTAMENTE en lastPrice para que
  // el header del chart cuadre con el "Último precio" mostrado arriba.
  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1]!;
    const adjustedClose = lastPrice;
    const adjustedHigh = Math.max(lastCandle.high, adjustedClose);
    const adjustedLow = Math.min(lastCandle.low, adjustedClose);
    candles[candles.length - 1] = {
      ...lastCandle,
      close: adjustedClose,
      high: adjustedHigh,
      low: adjustedLow,
    };
  }

  return candles;
}

/**
 * Devuelve un precio histórico de "arranque" para ofertas que el demo
 * cuenta como re-priced (el bono solar SOLNOR cotizaba ~$210 al lanzar y
 * corrigió a su precio actual tras revaluación de PPAs). Para el resto se
 * deja `undefined` y el generador usa su heurística por defecto.
 */
export function getHistoricalStartPrice(symbol: string): number | undefined {
  const upper = symbol.toUpperCase();
  if (upper === 'SOLNOR') return 210.75;
  return undefined;
}

// PRNG determinístico (mulberry32) — barato y suficiente para visualización.
function mulberry32(a: number) {
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
