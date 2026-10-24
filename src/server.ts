import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { profiles, jobs, profile } from "./data.js";
import {
  match,
  makeVariant,
  verifyVariant,
  renderVariant,
  type Job,
} from "./core.js";
const db = new DatabaseSync(process.env.FIT_DB || "fit.sqlite");
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS variants(id INTEGER PRIMARY KEY, profile TEXT NOT NULL, job TEXT NOT NULL, payload TEXT NOT NULL)",
);
const publicJobs = existsSync("data/public-snapshot.json")
  ? (JSON.parse(readFileSync("data/public-snapshot.json", "utf8")) as Job[])
  : [];
const allJobs = [...jobs, ...publicJobs];
const token = process.env.FIT_TOKEN || "local-edit";
const host = process.env.HOST || "127.0.0.1";
if (host !== "127.0.0.1" && token === "local-edit")
  throw Error("external_binding_requires_token");
const server = createServer(async (req, res) => {
  const send = (status: number, value: unknown) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(JSON.stringify(value));
  };
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/api/state" && req.method === "GET") {
      send(200, {
        profiles: profiles.map((p) => ({ id: p.id, label: p.label })),
        jobs: allJobs,
        metrics: existsSync("docs/results/benchmark.json")
          ? JSON.parse(readFileSync("docs/results/benchmark.json", "utf8"))
          : null,
      });
      return;
    }
    if (url.pathname === "/api/match" && req.method === "GET") {
      const p = profile(url.searchParams.get("profile") || "systems");
      send(200, {
        cv: p.cv,
        github: p.github,
        ranked: allJobs
          .map((j) => ({ ...j, result: match(p.cv, p.github, j) }))
          .sort(
            (a, b) =>
              b.result.score - a.result.score || a.id.localeCompare(b.id),
          ),
      });
      return;
    }
    if (url.pathname === "/api/variant" && req.method === "POST") {
      if (req.headers.authorization !== `Bearer ${token}`) {
        send(403, { error: "edit_token_required" });
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 32000) {
          send(413, { error: "body_too_large" });
          return;
        }
      }
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(body);
      } catch {
        send(400, { error: "invalid_json" });
        return;
      }
      const p = profile(String(input.profileId));
      const job = allJobs.find((j) => j.id === input.jobId);
      if (!job) throw Error("job_not_found");
      const v =
        input.variant ??
        makeVariant(p.cv, p.github, job, input.order as string[] | undefined);
      verifyVariant(v, p.cv);
      if (v.jobId !== job.id) throw Error("job_mismatch");
      const receipt = db
        .prepare("INSERT INTO variants(profile,job,payload) VALUES(?,?,?)")
        .run(p.cv.id, job.id, JSON.stringify(v));
      send(200, {
        id: Number(receipt.lastInsertRowid),
        variant: v,
        markdown: renderVariant(v, p.cv),
      });
      return;
    }
    if (url.pathname === "/api/history" && req.method === "GET") {
      send(
        200,
        db
          .prepare(
            "SELECT id,profile,job,payload FROM variants ORDER BY id DESC LIMIT 30",
          )
          .all(),
      );
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      send(404, { error: "not_found" });
      return;
    }
    if (req.method !== "GET") {
      send(405, { error: "method_not_allowed" });
      return;
    }
    const file = resolve(
      "dist-web",
      "." + (url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!file.startsWith(resolve("dist-web") + "/") || !existsSync(file)) {
      send(404, { error: "not_found" });
      return;
    }
    res.writeHead(200, {
      "content-type":
        (
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
          } as Record<string, string>
        )[extname(file)] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'",
    });
    res.end(readFileSync(file));
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    const allowed = [
      "stale_source",
      "unsupported_bullet",
      "exact_bullet_permutation_required",
      "profile_not_found",
      "job_not_found",
      "job_mismatch",
      "invalid_variant",
    ];
    send(code === "stale_source" ? 409 : 400, {
      error: allowed.includes(code) ? code : "invalid_request",
    });
  }
});
server.on("clientError", (_e, socket) =>
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"),
);
server.listen(Number(process.env.PORT || 18124), host, () =>
  console.log(
    JSON.stringify({
      event: "listening",
      host,
      port: Number(process.env.PORT || 18124),
    }),
  ),
);
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
