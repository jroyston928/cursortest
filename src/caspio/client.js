import "dotenv/config";

const CASPIO_TOKEN_URL = process.env.CASPIO_TOKEN_URL;
const CLIENT_ID = process.env.CASPIO_CLIENT_ID;
const CLIENT_SECRET = process.env.CASPIO_CLIENT_SECRET;
const CASPIO_BASE_URL = process.env.CASPIO_BASE_URL;

function requireEnv() {
  const missing = [];
  if (!CASPIO_TOKEN_URL) missing.push("CASPIO_TOKEN_URL");
  if (!CLIENT_ID) missing.push("CASPIO_CLIENT_ID");
  if (!CLIENT_SECRET) missing.push("CASPIO_CLIENT_SECRET");
  if (!CASPIO_BASE_URL) missing.push("CASPIO_BASE_URL");
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
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const resp = await fetch(CASPIO_TOKEN_URL, {
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
  const url = `${CASPIO_BASE_URL}${path}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Caspio GET error (${resp.status}): ${text}`);
  }

  return resp.json();
}

/**
 * ✅ THIS IS THE EXPORT YOU WERE MISSING
 */
export async function caspioTableRecords(table, where = "") {
  const qs = where ? `?q.where=${encodeURIComponent(where)}` : "";
  const data = await caspioGet(`/rest/v2/tables/${table}/records${qs}`);
  return data.Result || [];
}

/**
 * Utility for safe WHERE clauses
 */
export function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}
