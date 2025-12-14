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

function normalizePhone(value) {
  const s = clean(value);
  return s;
}

function joinNonEmpty(parts, sep = ", ") {
  return parts.map(clean).filter(Boolean).join(sep);
}

function normalizeClientDetailsRow(r) {
  const base = normalizeClientRow(r);

  const address = joinNonEmpty(
    [
      pick(r, ["Address", "Street", "StreetAddress", "Address1", "Address_1", "HomeAddress", "MailingAddress"]),
      pick(r, ["Address2", "Address_2", "Apt", "Apartment", "Unit"]),
    ],
    " "
  );

  const city = pick(r, ["City", "city", "HomeCity"]);
  const state = pick(r, ["State", "state", "Province", "Region"]);
  const zip = pick(r, ["Zip", "ZipCode", "ZIP", "PostalCode", "PostCode"]);

  const pronouns = pick(r, ["Pronouns", "Pronoun", "PreferredPronouns", "Preferred_Pronouns"]);
  const ethnicity = pick(r, ["Ethnicity", "Race", "RaceEthnicity", "Race_Ethnicity"]);
  const culturalNotes = pick(r, [
    "CulturalNotes",
    "Cultural_Notes",
    "SpiritualReligiousCultural",
    "Spiritual_Religious_Cultural",
    "CulturalBeliefs",
    "Cultural_Beliefs",
  ]);

  // Guardian 1
  const g1Name = pick(r, ["Guardian1Name", "Guardian_1_Name", "Parent1Name", "Parent_1_Name", "PrimaryGuardianName"]);
  const g1Dob = pick(r, ["Guardian1DOB", "Guardian_1_DOB", "Parent1DOB", "Parent_1_DOB"]);
  const g1Rel = pick(r, ["Guardian1Relationship", "Guardian_1_Relationship", "Parent1Relationship", "Parent_1_Relationship"]);
  const g1Address = joinNonEmpty(
    [
      pick(r, ["Guardian1Address", "Guardian_1_Address", "Parent1Address", "Parent_1_Address"]),
      pick(r, ["Guardian1Address2", "Guardian_1_Address2", "Parent1Address2", "Parent_1_Address2"]),
    ],
    " "
  );
  const g1City = pick(r, ["Guardian1City", "Guardian_1_City", "Parent1City", "Parent_1_City"]);
  const g1State = pick(r, ["Guardian1State", "Guardian_1_State", "Parent1State", "Parent_1_State"]);
  const g1Zip = pick(r, ["Guardian1Zip", "Guardian_1_Zip", "Guardian1ZipCode", "Parent1Zip", "Parent_1_Zip"]);
  const g1HomePhone = normalizePhone(pick(r, ["Guardian1HomePhone", "Guardian_1_HomePhone", "Parent1HomePhone", "Parent_1_HomePhone", "HomePhone1"]));
  const g1WorkPhone = normalizePhone(pick(r, ["Guardian1WorkPhone", "Guardian_1_WorkPhone", "Parent1WorkPhone", "Parent_1_WorkPhone", "WorkPhone1"]));
  const g1CellPhone = normalizePhone(pick(r, ["Guardian1CellPhone", "Guardian_1_CellPhone", "Parent1CellPhone", "Parent_1_CellPhone", "CellPhone1", "Mobile1"]));
  const g1Email = pick(r, ["Guardian1Email", "Guardian_1_Email", "Parent1Email", "Parent_1_Email", "Email1"]);

  // Guardian 2
  const g2Name = pick(r, ["Guardian2Name", "Guardian_2_Name", "Parent2Name", "Parent_2_Name", "SecondaryGuardianName"]);
  const g2Dob = pick(r, ["Guardian2DOB", "Guardian_2_DOB", "Parent2DOB", "Parent_2_DOB"]);
  const g2Rel = pick(r, ["Guardian2Relationship", "Guardian_2_Relationship", "Parent2Relationship", "Parent_2_Relationship"]);
  const g2Address = joinNonEmpty(
    [
      pick(r, ["Guardian2Address", "Guardian_2_Address", "Parent2Address", "Parent_2_Address"]),
      pick(r, ["Guardian2Address2", "Guardian_2_Address2", "Parent2Address2", "Parent_2_Address2"]),
    ],
    " "
  );
  const g2City = pick(r, ["Guardian2City", "Guardian_2_City", "Parent2City", "Parent_2_City"]);
  const g2State = pick(r, ["Guardian2State", "Guardian_2_State", "Parent2State", "Parent_2_State"]);
  const g2Zip = pick(r, ["Guardian2Zip", "Guardian_2_Zip", "Guardian2ZipCode", "Parent2Zip", "Parent_2_Zip"]);
  const g2HomePhone = normalizePhone(pick(r, ["Guardian2HomePhone", "Guardian_2_HomePhone", "Parent2HomePhone", "Parent_2_HomePhone", "HomePhone2"]));
  const g2WorkPhone = normalizePhone(pick(r, ["Guardian2WorkPhone", "Guardian_2_WorkPhone", "Parent2WorkPhone", "Parent_2_WorkPhone", "WorkPhone2"]));
  const g2CellPhone = normalizePhone(pick(r, ["Guardian2CellPhone", "Guardian_2_CellPhone", "Parent2CellPhone", "Parent_2_CellPhone", "CellPhone2", "Mobile2"]));
  const g2Email = pick(r, ["Guardian2Email", "Guardian_2_Email", "Parent2Email", "Parent_2_Email", "Email2"]);

  const primaryContact = pick(r, ["PrimaryContact", "Primary_Contact", "PrimaryContactName", "Primary_Contact_Name"]);

  return {
    ...base,
    Address: address,
    City: city,
    State: state,
    ZipCode: zip,
    Pronouns: pronouns,
    Ethnicity: ethnicity,
    CulturalNotes: culturalNotes,

    Guardian1Name: g1Name,
    Guardian1DOB: g1Dob,
    Guardian1Relationship: g1Rel,
    Guardian1Address: g1Address,
    Guardian1City: g1City,
    Guardian1State: g1State,
    Guardian1ZipCode: g1Zip,
    Guardian1HomePhone: g1HomePhone,
    Guardian1WorkPhone: g1WorkPhone,
    Guardian1CellPhone: g1CellPhone,
    Guardian1Email: g1Email,

    Guardian2Name: g2Name,
    Guardian2DOB: g2Dob,
    Guardian2Relationship: g2Rel,
    Guardian2Address: g2Address,
    Guardian2City: g2City,
    Guardian2State: g2State,
    Guardian2ZipCode: g2Zip,
    Guardian2HomePhone: g2HomePhone,
    Guardian2WorkPhone: g2WorkPhone,
    Guardian2CellPhone: g2CellPhone,
    Guardian2Email: g2Email,

    PrimaryContact: primaryContact,
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

    res.json(rows[0] ? normalizeClientDetailsRow(rows[0]) : null);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

export default router;
