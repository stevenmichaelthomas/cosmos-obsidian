import { requestUrl } from 'obsidian';

// Minimal PostgREST client.
//
// The plugin only needs a handful of RPC calls and two reads, so it talks to
// PostgREST directly instead of bundling @supabase/supabase-js. That keeps the
// `ws` dependency, the auth layer's localStorage access, and ~660KB of ES5
// transpiled output out of the release build. Requests go through Obsidian's
// `requestUrl` so they work on mobile without CORS preflight issues.

export const SUPABASE_URL = 'https://gzhdsgkjwxjuelsvksde.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aGRzZ2tqd3hqdWVsc3Zrc2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjAzNzYsImV4cCI6MjA4OTczNjM3Nn0.D1B9zbnAynYDkydGVHMSuEP-rzwHoDh5812YLUrWizg';

const REST_URL = `${SUPABASE_URL}/rest/v1`;

export interface DbError {
  message: string;
}

export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

export interface DbCount {
  count: number | null;
  error: DbError | null;
}

function baseHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** Parse a response body, tolerating empty (204) and non-JSON payloads. */
function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** PostgREST reports failures as { message, details, hint, code }. */
function errorFrom(status: number, body: unknown): DbError {
  if (body && typeof body === 'object') {
    const { message } = body as { message?: unknown };
    if (typeof message === 'string' && message) return { message };
  }
  if (typeof body === 'string' && body) return { message: body };
  return { message: `HTTP ${status}` };
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key];
  }
  return undefined;
}

/** Read the total row count out of a `Content-Range: 0-0/12` header. */
function totalFromContentRange(value: string | undefined): number | null {
  if (!value) return null;
  const total = value.split('/')[1];
  if (!total || total === '*') return null;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : null;
}

interface Response<T> {
  data: T | null;
  error: DbError | null;
  headers: Record<string, string>;
}

async function send<T>(
  url: string,
  method: 'GET' | 'POST',
  extraHeaders?: Record<string, string>,
  body?: unknown,
): Promise<Response<T>> {
  try {
    const res = await requestUrl({
      url,
      method,
      headers: { ...baseHeaders(), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false,
    });
    const parsed = parseBody(res.text);
    if (res.status < 200 || res.status >= 300) {
      return { data: null, error: errorFrom(res.status, parsed), headers: res.headers };
    }
    return { data: parsed as T, error: null, headers: res.headers };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: { message }, headers: {} };
  }
}

export interface RpcOptions {
  /** Restrict the returned columns. */
  select?: string;
  /** Column to sort by. Needed for stable limit/offset pagination. */
  order?: string;
  limit?: number;
  offset?: number;
}

/**
 * Call a Postgres function.
 *
 * Pagination uses the limit/offset query parameters rather than the Range
 * header: Range is not honoured on this deployment's RPC endpoint, and a
 * silently ignored Range yields the whole set on every request.
 */
export async function rpc<T>(
  fn: string,
  args: Record<string, unknown>,
  options?: RpcOptions,
): Promise<DbResult<T>> {
  const params = new URLSearchParams();
  if (options?.select !== undefined) params.set('select', options.select);
  if (options?.order !== undefined) params.set('order', options.order);
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.offset !== undefined) params.set('offset', String(options.offset));
  const query = params.toString();
  const url = query ? `${REST_URL}/rpc/${fn}?${query}` : `${REST_URL}/rpc/${fn}`;
  const res = await send<T>(url, 'POST', undefined, args);
  return { data: res.data, error: res.error };
}

/** Select the first matching row, or null when nothing matches. */
export async function selectMaybeSingle<T>(
  table: string,
  columns: string,
  filters: Record<string, string>,
): Promise<DbResult<T>> {
  const params = new URLSearchParams({ ...filters, select: columns, limit: '1' });
  const res = await send<T[]>(`${REST_URL}/${table}?${params.toString()}`, 'GET');
  if (res.error) return { data: null, error: res.error };
  const rows = Array.isArray(res.data) ? res.data : [];
  return { data: rows.length > 0 ? rows[0] : null, error: null };
}

/** Count matching rows without transferring them. */
export async function count(
  table: string,
  filters: Record<string, string>,
): Promise<DbCount> {
  const params = new URLSearchParams({ ...filters, select: 'id' });
  const res = await send<unknown[]>(`${REST_URL}/${table}?${params.toString()}`, 'GET', {
    Prefer: 'count=exact',
    'Range-Unit': 'items',
    Range: '0-0',
  });
  if (res.error) return { count: null, error: res.error };
  const total = totalFromContentRange(headerValue(res.headers, 'content-range'));
  if (total !== null) return { count: total, error: null };
  return { count: Array.isArray(res.data) ? res.data.length : 0, error: null };
}
