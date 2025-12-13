import "dotenv/config";
import express from "express";
import clientsRouter from "./src/routes/clients.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/clients", clientsRouter);

app.listen(3000, () => console.log("Running on http://localhost:3000"));
