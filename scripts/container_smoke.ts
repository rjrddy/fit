import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const d = (...args: string[]) =>
  execFileSync("docker", args, { encoding: "utf8" }).trim();
const name = "fit-ci-" + process.pid,
  volume = name + "-data";
const base = "http://127.0.0.1:18126";
async function ready() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/state")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("container_not_ready");
}
try {
  d("volume", "create", volume);
  d(
    "run",
    "-d",
    "--name",
    name,
    "-e",
    "FIT_TOKEN=ci-distinct-token",
    "-v",
    volume + ":/data",
    "-p",
    "127.0.0.1:18126:18124",
    "fit:test",
  );
  await ready();
  const r = await fetch(base + "/api/variant", {
    method: "POST",
    headers: {
      authorization: "Bearer ci-distinct-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ profileId: "systems", jobId: "systems-junior" }),
  });
  if (!r.ok) throw Error("container_write_failed");
  d("restart", name);
  await ready();
  const h = (await fetch(base + "/api/history").then((r) =>
    r.json(),
  )) as unknown[];
  if (h.length !== 1) throw Error("container_restart_lost_receipt");
  writeFileSync(
    "docs/results/container-proof.json",
    JSON.stringify(
      {
        image: "fit:test",
        nonRootUid: d("exec", name, "id", "-u"),
        persistedAfterRestart: h.length,
        publicDeployment: false,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  try {
    d("rm", "-f", name);
  } catch {}
  try {
    d("volume", "rm", volume);
  } catch {}
}
