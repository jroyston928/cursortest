import express from "express";
import { caspioTableRecords, sqlEscape } from "../caspio/client.js";

const router = express.Router();
const TABLE = "ABA1_Client_tbl";

// GET /api/clients/search?q=smith
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

    const s = sqlEscape(q);
    const where =
      `(FirstName LIKE '%${s}%') OR (LastName LIKE '%${s}%') OR (FullName LIKE '%${s}%')`;

    const rows = await caspioTableRecords(TABLE, where);

    res.json(rows.map(r => ({
      Client_ID: r.Client_ID,
      FirstName: r.FirstName,
      LastName: r.LastName,
      FullName: r.FullName,
      DOB: r.DOB,
      Age: r.Age
    })));
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
    const rows = await caspioTableRecords(TABLE, where);

    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

export default router;
