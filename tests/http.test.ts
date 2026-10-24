import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { profile, jobs } from "../src/data.js";
import { makeVariant } from "../src/core.js";
test("HTTP auth, forged claims, stale hashes, restart durability and safe errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fit-test-"));
  let child: ChildProcess | undefined;
  const receipts: unknown[] = [];
  let logs = "";
  const base = "http://127.0.0.1:18125";
  async function start() {
    child = spawn(process.execPath, ["dist-node/src/server.js"], {
      env: { ...process.env, PORT: "18125", FIT_DB: join(dir, "db.sqlite") },
    });
    child.stdout!.on("data", (d) => {
      logs += d;
    });
    child.stderr!.on("data", (d) => {
      logs += d;
    });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/state")).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error("startup_failed");
  }
  async function stop() {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
  async function post(body: unknown, token = "local-edit") {
    return fetch(base + "/api/variant", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  try {
    await start();
    const { cv, github } = profile("systems");
    const v = makeVariant(cv, github, jobs[0]);
    const input = { profileId: "systems", jobId: jobs[0].id, variant: v };
    let r = await post(input, "wrong-secret-canary");
    assert.equal(r.status, 403);
    receipts.push({ case: "wrong_token", status: r.status });
    v.bullets[0].text += " FAKE-CLAIM-CANARY";
    r = await post(input);
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: "unsupported_bullet" });
    receipts.push({
      case: "forged_claim",
      status: r.status,
      error: "unsupported_bullet",
    });
    const valid = makeVariant(cv, github, jobs[0]);
    r = await post({ ...input, variant: { ...valid, sourceSha256: "stale" } });
    assert.equal(r.status, 409);
    receipts.push({ case: "stale_source", status: r.status });
    r = await post({ ...input, variant: valid });
    assert.equal(r.status, 200);
    const saved = (await r.json()) as { id: number; markdown: string };
    assert.ok(saved.markdown.includes(cv.bullets[0].text));
    r = await fetch(base + "/api/variant", {
      method: "POST",
      headers: { authorization: "Bearer local-edit" },
      body: "{SECRET-BODY-CANARY",
    });
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: "invalid_json" });
    await stop();
    await start();
    const history = (await fetch(base + "/api/history").then((r) =>
      r.json(),
    )) as { id: number }[];
    assert.ok(history.some((x) => x.id === saved.id));
    receipts.push({
      case: "committed_receipt_survives_process_restart",
      id: saved.id,
      passed: true,
    });
    await stop();
    assert.ok(!logs.includes("CANARY"));
    writeFileSync(
      "docs/results/http-proof.json",
      JSON.stringify(
        {
          receipts,
          logsContainCanary: false,
          scope:
            "Actual loopback HTTP and SQLite clean process restart, not power loss",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
