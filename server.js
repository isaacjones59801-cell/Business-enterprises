// Collection Enterprises - TickerMint proxy server
// Requires Node.js 18+. Keep any TickerMint key on the server, never in browser code.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const API = 'https://api.tickermint.cards';
const ROOT = __dirname;
const cache = new Map();
const CACHE_MS = 60 * 60 * 1000;
const MAX_URL = 1800;
const API_KEY = String(process.env.TICKERMINT_API_KEY || '').trim();

function send(res, status, body, type='application/json; charset=utf-8', extra={}) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  });
  res.end(body);
}
function json(value) { return JSON.stringify(value); }
function safeUpstreamError(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed.detail || parsed.message || parsed.error || parsed.how_to_fix || body.slice(0, 500);
  } catch (_) { return body.slice(0, 500) || 'TickerMint returned an empty error response'; }
}
function quotaHeaders(upstream) {
  const headers = {};
  for (const name of ['x-quota-limit', 'x-quota-remaining', 'x-quota-reset']) {
    const value = upstream.headers.get(name);
    if (value !== null) headers['X-TickerMint-' + name.slice(2).replace(/(^|-)([a-z])/g, (_, dash, c) => c.toUpperCase())] = value;
  }
  return headers;
}

async function requestTickerMint(target) {
  const headers = { Accept: 'application/json', 'User-Agent': 'CollectionEnterprises/1.2' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const upstream = await fetch(target, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });
  const body = await upstream.text();
  if (!upstream.ok) {
    const error = new Error(safeUpstreamError(body));
    error.status = upstream.status;
    error.quota = quotaHeaders(upstream);
    throw error;
  }
  let parsed;
  try { parsed = JSON.parse(body); }
  catch (_) { throw new Error('TickerMint returned invalid JSON.'); }
  return { body, parsed, headers: quotaHeaders(upstream) };
}

async function proxyTickerMint(req, res, url) {
  const prefix = '/api/tickermint/';
  const suffix = url.pathname.slice(prefix.length);
  if (!suffix || suffix.includes('..') || suffix.includes('\\')) {
    return send(res, 400, json({ error: 'Invalid TickerMint API path' }));
  }

  const isSearch = suffix === 'products/search';
  const isDetail = /^products\/[0-9]+$/.test(suffix);
  const isConnectionTest = suffix === 'connection-test';
  if (!isSearch && !isDetail && !isConnectionTest) {
    return send(res, 404, json({ error: 'TickerMint endpoint not supported' }));
  }

  const target = new URL(isDetail ? '/' + suffix : '/products/search', API);
  if (isSearch || isConnectionTest) {
    const q = isConnectionTest ? 'charizard ex 199/165' : (url.searchParams.get('q') || '');
    const game = isConnectionTest ? 'pokemon' : (url.searchParams.get('game') || 'pokemon');
    if (q.trim().length < 2 || q.length > 160 || game !== 'pokemon') {
      return send(res, 400, json({ error: 'Search requires a 2–160 character query for game=pokemon' }));
    }
    target.searchParams.set('q', q);
    target.searchParams.set('game', game);
  }
  if (target.href.length > MAX_URL) return send(res, 414, json({ error: 'Request too long' }));

  const cacheKey = target.href;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_MS) {
    return send(res, 200, cached.body, 'application/json; charset=utf-8', {
      'Cache-Control': 'public, max-age=300',
      'X-TickerMint-Cache': 'HIT',
      ...cached.headers
    });
  }

  try {
    const result = await requestTickerMint(target);
    if (isSearch || isConnectionTest) {
      if (!Array.isArray(result.parsed)) throw new Error('TickerMint search returned an unexpected response format.');
    } else if (!result.parsed || typeof result.parsed !== 'object' || Array.isArray(result.parsed)) {
      throw new Error('TickerMint product lookup returned an unexpected response format.');
    }
    cache.set(cacheKey, { time: Date.now(), body: result.body, headers: result.headers });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return send(res, 200, result.body, 'application/json; charset=utf-8', {
      'Cache-Control': 'public, max-age=300',
      'X-TickerMint-Cache': 'MISS',
      ...result.headers
    });
  } catch (err) {
    const upstreamStatus = Number(err.status || 0);
    let status = 502;
    if (upstreamStatus === 429) status = 429;
    else if (upstreamStatus === 401 || upstreamStatus === 403 || upstreamStatus === 402) status = upstreamStatus;
    else if (upstreamStatus >= 400 && upstreamStatus < 500) status = upstreamStatus;
    const message = upstreamStatus === 429
      ? 'TickerMint daily lookup limit reached. Wait for the quota reset or use an authorized key.'
      : upstreamStatus === 401 || upstreamStatus === 403
        ? 'TickerMint rejected the API key or request. Check the server-side TICKERMINT_API_KEY setting and account access.'
        : upstreamStatus === 402
          ? 'TickerMint requires a plan that includes this request.'
          : 'Could not complete the TickerMint request.';
    return send(res, status, json({ error: message, detail: String(err.message || err) }), 'application/json; charset=utf-8', err.quota || {});
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch (_) { return send(res, 400, json({ error: 'Invalid request URL' })); }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, json({ error: 'Method not allowed' }), 'application/json; charset=utf-8', { Allow: 'GET, HEAD' });
  }
  if (url.pathname.startsWith('/api/tickermint/')) return proxyTickerMint(req, res, url);
  if (url.pathname === '/health') {
    return send(res, 200, json({ ok: true, service: 'Collection Enterprises', node: process.version, tickermintKeyConfigured: Boolean(API_KEY) }));
  }

  let requested;
  try { requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.replace(/^\/+/, '')); }
  catch (_) { return send(res, 400, json({ error: 'Invalid file path' })); }
  const resolved = path.resolve(ROOT, requested);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== path.join(ROOT, 'index.html')) {
    return send(res, 403, json({ error: 'Forbidden' }));
  }
  fs.readFile(resolved, (err, data) => {
    if (err) return send(res, 404, json({ error: 'File not found' }));
    const ext = path.extname(resolved).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' :
                 ext === '.js' ? 'text/javascript; charset=utf-8' :
                 ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Collection Enterprises running at http://localhost:${PORT}`);
  console.log(`TickerMint API key: ${API_KEY ? 'configured on server' : 'not configured (no-key quota applies)'}`);
});
