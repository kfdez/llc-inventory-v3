import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
// @ts-ignore
import worker from "./src/worker.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.text());
  app.use(express.raw());

  // Handle API routes via worker fetch handler
  app.all("/api/*", async (req, res) => {
    try {
      const url = new URL(req.originalUrl || req.url, `http://${req.headers.host || "localhost"}`);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v) {
          if (Array.isArray(v)) {
            v.forEach(val => headers.append(k, val));
          } else {
            headers.set(k, v);
          }
        }
      }

      let body: string | undefined = undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (typeof req.body === "string") {
          body = req.body;
        } else if (req.body && Object.keys(req.body).length > 0) {
          body = JSON.stringify(req.body);
        }
      }

      const webRequest = new Request(url.toString(), {
        method: req.method,
        headers,
        body,
      });

      const env = {
        APPS_SCRIPT_API_BASE_URL: process.env.APPS_SCRIPT_API_BASE_URL || "",
        APP_PIN: process.env.APP_PIN || "",
        COLLECTR_ACCOUNT_ID: process.env.COLLECTR_ACCOUNT_ID || "",
        COLLECTR_AUTH_TOKEN: process.env.COLLECTR_AUTH_TOKEN || "",
        COLLECTR_API_BASE_URL: process.env.COLLECTR_API_BASE_URL || "",
        COLLECTR_CURRENCY: process.env.COLLECTR_CURRENCY || "CAD",
        COLLECTR_PROXY_BASE_URL: process.env.COLLECTR_PROXY_BASE_URL || "",
        COLLECTR_PROXY_SECRET: process.env.COLLECTR_PROXY_SECRET || "",
      };

      const webRes = await worker.fetch(webRequest, env, {} as any);
      res.status(webRes.status);
      webRes.headers.forEach((val: string, key: string) => {
        if (key.toLowerCase() !== "content-encoding") {
          res.setHeader(key, val);
        }
      });
      const responseArrayBuffer = await webRes.arrayBuffer();
      res.send(Buffer.from(responseArrayBuffer));
    } catch (err) {
      console.error("[API Error]", err);
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LLC Inventory Scanner PWA running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
