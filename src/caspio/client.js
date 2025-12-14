import "dotenv/config";

function requireEnv() {
  const missing = [];
  if (!process.env.CASPIO_TOKEN_URL) missing.push("CASPIO_TOKEN_URL");
  if (!process.env.CASPIO_CLIENT_ID) missing.push("CASPIO_CLIENT_ID");
  if (!process.env.CASPIO_CLIENT_SECRET) missing.push("CASPIO_CLIENT_SECRET");
  if (!process.env.CASPIO_BASE_URL) missing.push("CASPIO_BASE_URL");
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

let cachedToken = null;
let tokenExpiresAtMs = 0;

async function getAccessToken() {
  requireEnv();

  const now = Date.now();
  if (cachedToken && now < tokenExpiresAtMs - 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CASPIO_CLIENT_ID,
    client_secret: process.env.CASPIO_CLIENT_SECRET,
  });

  const resp = await fetch(process.env.CASPIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Caspio token error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  cachedToken = data.access_token;

  const expiresInSec = Number(data.expires_in || 1800);
  tokenExpiresAtMs = now + expiresInSec * 1000;

  return cachedToken;
}

async function caspioGet(path) {
  const token = await getAccessToken();
  const url = `${process.env.CASPIO_BASE_URL}${path}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Caspio GET error (${resp.status}): ${text}`);
  }

  return resp.json();
}

function buildCaspioQuery(params) {
  const qs = new URLSearchParams();
  if (params?.where) qs.set("q.where", params.where);
  if (params?.select) qs.set("q.select", params.select);
  if (params?.orderBy) qs.set("q.orderBy", params.orderBy);
  if (params?.pageSize) qs.set("q.pageSize", String(params.pageSize));
  if (params?.pageNumber) qs.set("q.pageNumber", String(params.pageNumber));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function caspioTableQuery(table, params = {}) {
  const qs = buildCaspioQuery(params);
  return caspioGet(`/rest/v2/tables/${table}/records${qs}`);
}

export async function caspioTableRecords(table, params = {}) {
  const data = await caspioTableQuery(table, params);
  return data.Result || [];
}

/**
 * Utility for safe WHERE clauses
 */
export function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}
