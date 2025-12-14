import express from "express";
import { caspioTableRecords, sqlEscape } from "../caspio/client.js";

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

function normalizeClientRow(r) {
  const clientId = pick(r, ["Client_ID", "ClientID", "Client ID", "id"]);
  const firstName = pick(r, ["FirstName", "First_Name", "First Name"]);
  const lastName = pick(r, ["LastName", "Last_Name", "Last Name"]);
  const fullName =
    pick(r, ["FullName", "Full_Name", "Full Name"]) ||
    [firstName, lastName].filter(Boolean).join(" ");

  return {
    Client_ID: clientId,
    FirstName: firstName,
    LastName: lastName,
    FullName: fullName,
    DOB: pick(r, ["DOB", "Dob", "DateOfBirth", "Date Of Birth", "Date_Of_Birth"]),
    Age: pick(r, ["Age"]),
  };
}

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
