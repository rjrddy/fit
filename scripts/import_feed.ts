import { mkdirSync, writeFileSync } from "node:fs";
import { fetchGreenhouse } from "../src/feed.js";
const board = process.argv[2] || "cloudflare";
try {
  const result = await fetchGreenhouse(board);
  mkdirSync("data", { recursive: true });
  mkdirSync("docs/results", { recursive: true });
  writeFileSync(
    "data/public-snapshot.json",
    JSON.stringify(result.jobs, null, 2) + "\n",
  );
  writeFileSync(
    "docs/results/public-feed-provenance.json",
    JSON.stringify(result.provenance, null, 2) + "\n",
  );
  console.log(JSON.stringify(result.provenance, null, 2));
} catch (e) {
  console.error(
    JSON.stringify({ event: "feed_failed", code: "public_feed_unavailable" }),
  );
  process.exitCode = 1;
}
