// Collection Enterprises — secure Netlify proxy for TickerMint.
"use strict";
const API = "https://api.tickermint.cards";
const API_KEY = String(process.env.TICKERMINT_API_KEY || "").trim();
const cache = new Map();
const TTL = 60 * 60 * 1000;

const send = (statusCode, data, headers = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120",
    "X-Content-Type-Options": "nosniff",
    ...headers
  },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return send(405, { error: "GET only." }, { Allow: "GET" });

  const marker = "/.netlify/functions/tickermint";
  const path = String(event.path || "").split(marker).pop().replace(/^\/+/, "");
  const isSearch = path === "products/search";
  const isDetail = /^products\/[0-9]+$/.test(path);
  const isTest = path === "connection-test";
  if (!isSearch && !isDetail && !isTest) return send(404, { error: "Unknown TickerMint route." });

  const qs = event.queryStringParameters || {};
  const url = new URL(isDetail ? "/" + path : "/products/search", API);
  if (isSearch || isTest) {
    const q = isTest ? "charizard ex 199/165" : String(qs.q || "");
    const game = isTest ? "pokemon" : String(qs.game || "pokemon");
    if (q.trim().length < 2 || q.length > 160 || game !== "pokemon") {
      return send(400, { error: "Search must be 2–160 characters and game=pokemon." });
    }
    url.searchParams.set("q", q);
    url.searchParams.set("game", game);
  }

  const key = url.href;
  const old = cache.get(key);
  if (old && Date.now() - old.time < TTL) return send(200, old.data, { "X-TickerMint-Cache": "HIT" });

  try {
    const headers = { Accept: "application/json", "User-Agent": "CollectionEnterprises/1.0" };
    if (API_KEY) headers["x-api-key"] = API_KEY;
    const response = await fetch(url.href, { headers, signal: AbortSignal.timeout(12000) });
    const body = await response.text();
    if (!response.ok) {
      let msg = "TickerMint request failed.";
      if (response.status === 401 || response.status === 403) msg = "TickerMint rejected the API key or account access. Check the private Netlify TICKERMINT_API_KEY variable.";
      if (response.status === 402) msg = "TickerMint requires a plan that permits this request.";
      if (response.status === 429) msg = "TickerMint lookup quota reached. Try after the quota resets.";
      let detail = body.slice(0, 300);
      try { const e = JSON.parse(body); detail = e.detail || e.message || e.error || detail; } catch {}
      return send(response.status >= 400 && response.status < 500 ? response.status : 502, { error: msg, detail });
    }
    let data;
    try { data = JSON.parse(body); } catch { return send(502, { error: "TickerMint returned invalid JSON." }); }
    if ((isSearch || isTest) && !Array.isArray(data)) return send(502, { error: "Unexpected TickerMint search response." });
    if (isDetail && (!data || typeof data !== "object" || Array.isArray(data))) return send(502, { error: "Unexpected TickerMint product response." });
    cache.set(key, { time: Date.now(), data });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return send(200, data, { "X-TickerMint-Cache": "MISS" });
  } catch (e) {
    return send(502, { error: "Netlify could not reach TickerMint.", detail: String(e && e.message || e) });
  }
};
