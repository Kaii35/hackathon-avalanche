export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === undefined
    ? true
    : process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequest<TBody> {
  method?: Method;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function call<TResponse, TBody = unknown>(
  path: string,
  { method = 'GET', body, headers, signal }: ApiRequest<TBody> = {},
): Promise<TResponse> {
  const url = path.startsWith('http') ? path : path;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    throw new ApiError(res.status, `Error ${res.status}`, payload);
  }
  if (res.status === 204) return undefined as TResponse;
  return (await res.json()) as TResponse;
}

/**
 * Wrapper that gracefully falls back to mock data when the API is missing.
 * `mock` is invoked when `NEXT_PUBLIC_USE_MOCKS` is true, on network failure, or on HTTP 404/501.
 */
export async function apiOrMock<T, TBody = unknown>(
  path: string,
  mock: () => T | Promise<T>,
  opts?: ApiRequest<TBody>,
): Promise<T> {
  if (USE_MOCKS) return await mock();
  try {
    return await call<T, TBody>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
      return await mock();
    }
    if (!(err instanceof ApiError)) {
      return await mock();
    }
    throw err;
  }
}

export const api = { call };
