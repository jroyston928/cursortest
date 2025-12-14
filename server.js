import "dotenv/config";
import express from "express";
import clientsRouter from "./src/routes/clients.js";

const app = express();
app.use(express.json());
const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3000);

app.use(
  express.static("public", {
    // Avoid stale HTML in dev/Codespaces; allow normal caching behavior in prod.
    etag: isProd,
    lastModified: isProd,
    setHeaders(res, path) {
      if (path.endsWith(".html")) {
        res.setHeader(
          "Cache-Control",
          isProd ? "no-cache" : "no-store, max-age=0"
        );
      }
    },
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/clients", clientsRouter);

app.listen(port, () => console.log(`Running on http://localhost:${port}`));
