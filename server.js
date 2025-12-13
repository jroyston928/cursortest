import "dotenv/config";
import express from "express";
import clientsRouter from "./src/routes/clients.js";

const app = express();
app.use(express.json());
app.use(
  express.static("public", {
    // In Codespaces/dev, aggressively disable HTML caching so UI changes show up immediately.
    etag: false,
    lastModified: false,
    setHeaders(res, path) {
      if (path.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store, max-age=0");
      }
    },
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/clients", clientsRouter);

app.listen(3000, () => console.log("Running on http://localhost:3000"));
