import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '../logger';

/**
 * Sumsub API client + webhook verifier.
 *
 * Auth scheme (every request):
 *   X-App-Token:       <app token>
 *   X-App-Access-Ts:   <unix seconds>
 *   X-App-Access-Sig:  HMAC-SHA256( ts + METHOD + path?query + body , secret )
 *
 * Webhook signature:
 *   header `x-payload-digest` = HMAC( raw_body, webhook_secret )
 *   algorithm in `x-payload-digest-alg` (HMAC_SHA256_HEX | HMAC_SHA1_HEX | HMAC_SHA512_HEX)
 *
 * Docs: https://docs.sumsub.com/reference/about-sumsub-api
 */

// Trim trailing slashes — Jetty (Sumsub's web server) rejects URLs with
// '//' as "Ambiguous URI empty segment", which happens when env has a
// trailing slash and paths start with '/'.
const BASE_URL = (process.env.SUMSUB_BASE_URL ?? 'https://api.sumsub.com').replace(/\/+$/, '');
const APP_TOKEN = process.env.SUMSUB_APP_TOKEN ?? '';
const SECRET = process.env.SUMSUB_SECRET_KEY ?? '';
const LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME ?? 'basic-kyc-level';
const WEBHOOK_SECRET = process.env.SUMSUB_WEBHOOK_SECRET ?? SECRET;

function assertConfigured() {
  if (!APP_TOKEN || !SECRET) {
    throw new Error('Sumsub no configurado: define SUMSUB_APP_TOKEN y SUMSUB_SECRET_KEY en .env');
  }
}

function sign(ts: number, method: string, pathAndQuery: string, body: string) {
  const material = `${ts}${method.toUpperCase()}${pathAndQuery}${body}`;
  return createHmac('sha256', SECRET).update(material).digest('hex');
}

async function call<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  pathAndQuery: string,
  body?: unknown,
): Promise<T> {
  assertConfigured();
  const ts = Math.floor(Date.now() / 1000);
  const rawBody = body !== undefined ? JSON.stringify(body) : '';
  const sig = sign(ts, method, pathAndQuery, rawBody);

  const url = `${BASE_URL}${pathAndQuery}`;
  const res = await fetch(url, {
    method,
    headers: {
      'X-App-Token': APP_TOKEN,
      'X-App-Access-Ts': String(ts),
      'X-App-Access-Sig': sig,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: rawBody || undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    logger.warn({ status: res.status, url, body: text.slice(0, 500) }, 'sumsub.api.error');
    throw new Error(`Sumsub ${method} ${pathAndQuery} → ${res.status}: ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface SumsubApplicant {
  id: string;
  externalUserId: string;
  inspectionId?: string;
  review?: {
    reviewStatus?: string;
    reviewResult?: { reviewAnswer?: 'GREEN' | 'RED'; rejectLabels?: string[] };
  };
}

/**
 * Best-effort lookup by externalUserId. Returns null if Sumsub returns 404.
 */
async function getApplicantByExternalId(externalUserId: string): Promise<SumsubApplicant | null> {
  try {
    // The dash before semicolon is required by Sumsub's URL convention.
    return await call<SumsubApplicant>(
      'GET',
      `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`,
    );
  } catch (e) {
    if (String(e).includes('404')) return null;
    throw e;
  }
}

async function createApplicant(externalUserId: string): Promise<SumsubApplicant> {
  return call<SumsubApplicant>(
    'POST',
    `/resources/applicants?levelName=${encodeURIComponent(LEVEL_NAME)}`,
    { externalUserId },
  );
}

/**
 * Ensure an applicant exists for this user. Idempotent.
 */
async function ensureApplicant(externalUserId: string): Promise<SumsubApplicant> {
  const existing = await getApplicantByExternalId(externalUserId);
  if (existing) return existing;
  return createApplicant(externalUserId);
}

interface AccessTokenResponse {
  token: string;
  userId: string;
}

/**
 * Generate a one-shot WebSDK access token. Single-use, ~10 min TTL.
 */
async function generateAccessToken(externalUserId: string): Promise<AccessTokenResponse> {
  const path =
    `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}` +
    `&levelName=${encodeURIComponent(LEVEL_NAME)}` +
    `&ttlInSecs=600`;
  return call<AccessTokenResponse>('POST', path);
}

/**
 * Verify the HMAC of a webhook callback.
 * `rawBody` MUST be the un-parsed request body string.
 */
function verifyWebhook(rawBody: string, header: { digest?: string; alg?: string }): boolean {
  if (!header.digest) return false;
  const alg = (header.alg ?? 'HMAC_SHA256_HEX').toUpperCase();
  const algo = alg === 'HMAC_SHA1_HEX' ? 'sha1' : alg === 'HMAC_SHA512_HEX' ? 'sha512' : 'sha256';
  const expected = createHmac(algo, WEBHOOK_SECRET).update(rawBody).digest('hex');
  const got = header.digest.toLowerCase().replace(/^0x/, '');
  if (expected.length !== got.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(got, 'hex'));
  } catch {
    return false;
  }
}

export const sumsub = {
  isConfigured: () => Boolean(APP_TOKEN && SECRET),
  levelName: LEVEL_NAME,
  ensureApplicant,
  getApplicantByExternalId,
  generateAccessToken,
  verifyWebhook,
};
