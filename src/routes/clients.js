import express from "express";
import { caspioTableQuery, caspioTableRecords, sqlEscape } from "../caspio/client.js";

const router = express.Router();
const TABLE = "ABA1_Client_tbl";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clean(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function pick(obj, keys) {
  for (const k of keys) {
    // bracket access supports odd Caspio column names too (e.g. "First Name")
    const v = clean(obj ? obj[k] : "");
    if (v) return v;
  }
  return "";
}

function clampInt(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function computeAgeYears({ age, dob }) {
  const ageNum = toNumberOrNull(age);
  if (ageNum !== null) return Math.max(0, Math.trunc(ageNum));
  const d = dob ? new Date(dob) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
  return Math.max(0, years);
}

function normalizePercent(value) {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  // Accept 0..1 or 0..100.
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function normalizeClientRow(r) {
  const clientId = pick(r, ["Client_ID", "ClientID", "Client ID", "id"]);
  const firstName = pick(r, ["FirstName", "First_Name", "First Name"]);
  const lastName = pick(r, ["LastName", "Last_Name", "Last Name"]);
  const fullName =
    pick(r, ["FullName", "Full_Name", "Full Name"]) ||
    [firstName, lastName].filter(Boolean).join(" ");
  const dob = pick(r, ["DOB", "Dob", "DateOfBirth", "Date Of Birth", "Date_Of_Birth"]);
  const ageYears = computeAgeYears({ age: pick(r, ["Age"]), dob });

  return {
    Client_ID: clientId,
    FirstName: firstName,
    LastName: lastName,
    FullName: fullName,
    DOB: dob,
    Age: ageYears,

    // Optional fields used by the table UI (populated if columns exist in Caspio)
    Gender: pick(r, ["Gender", "gender", "Sex", "sex"]),
    CenterLocation: pick(r, ["CenterLocation", "Center_Location", "Center Location", "Location", "Center"]),
    SupervisingBcba: pick(r, ["SupervisingBcba", "SupervisingBCBA", "Supervising BCBA", "BCBA", "Supervisor"]),
    SupervisingBcbaPercent: normalizePercent(
      pick(r, [
        "SupervisingBcbaPercent",
        "SupervisingBCBAPercent",
        "Supervising_BCBA_Percent",
        "SupervisingBcbaProgress",
        "Progress",
        "Percent",
      ])
    ),
  };
}

function inferTotalFromCaspioResponse(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.TotalRecordCount,
    data.TotalCount,
    data.Total,
    data.Count,
    data.RecordCount,
    data.ResultCount,
  ];
  for (const c of candidates) {
    const n = toNumberOrNull(c);
    if (n !== null) return n;
  }
  return null;
}

// GET /api/clients? (paginated list with optional search)
router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = clampInt(req.query.page, { min: 1, max: 10_000, fallback: 1 });
    const limit = clampInt(req.query.limit, {
      min: 1,
      max: MAX_LIMIT,
      fallback: DEFAULT_LIMIT,
    });

    const where = q
      ? `(FirstName LIKE '%${sqlEscape(q)}%') OR (LastName LIKE '%${sqlEscape(
          q
        )}%') OR (FullName LIKE '%${sqlEscape(q)}%')`
      : "";

    const data = await caspioTableQuery(TABLE, {
      where,
      orderBy: "FullName",
      pageNumber: page,
      pageSize: limit,
    });

    const rows = Array.isArray(data?.Result) ? data.Result : [];
    const total = inferTotalFromCaspioResponse(data);
    const totalPages =
      total !== null ? Math.max(1, Math.ceil(total / limit)) : null;

    res.json({
      page,
      pageSize: limit,
      total,
      totalPages,
      items: rows.map(normalizeClientRow),
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// GET /api/clients/search?q=smith
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

    const limit = clampInt(req.query.limit, {
      min: 1,
      max: MAX_LIMIT,
      fallback: DEFAULT_LIMIT,
    });

    const s = sqlEscape(q);
    const where =
      `(FirstName LIKE '%${s}%') OR (LastName LIKE '%${s}%') OR (FullName LIKE '%${s}%')`;

    const rows = await caspioTableRecords(TABLE, { where, pageSize: limit });

    res.json(rows.map(normalizeClientRow));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// GET /api/clients/:id
router.get("/:id", async (req, res) => {
  try {
    const id = (req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing Client_ID" });

    const where = `Client_ID = '${sqlEscape(id)}'`;
    const rows = await caspioTableRecords(TABLE, { where, pageSize: 1 });

    res.json(rows[0] ? normalizeClientRow(rows[0]) : null);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

export default router;
