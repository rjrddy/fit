import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { profiles, jobs, profile } from "../src/data.js";
import { match, makeVariant, verifyVariant, sha } from "../src/core.js";
const labels = JSON.parse(readFileSync("data/development-labels.json", "utf8"));
const words = (s: string): string[] =>
  s.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) || [];
const docs = jobs.map((j) => words(j.text));
const vocab = [...new Set(docs.flat())];
const idf = new Map(
  vocab.map((w) => [
    w,
    Math.log(
      (jobs.length + 1) / (1 + docs.filter((d) => d.includes(w)).length),
    ) + 1,
  ]),
);
function vector(s: string) {
  const ws = words(s);
  return vocab.map((w) => ws.filter((x) => x === w).length * idf.get(w)!);
}
function cosine(a: number[], b: number[]) {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  return dot / (Math.hypot(...a) * Math.hypot(...b) || 1);
}
const judgments = Array.isArray(labels)
  ? labels
  : labels.judgments || labels.labels || labels.pairs;
if (!Array.isArray(judgments)) throw Error("inspect_label_schema");
function grade(pid: string, jid: string) {
  const row = judgments.find(
    (r: any) =>
      (r.profileId || r.profile) === pid && (r.jobId || r.job) === jid,
  );
  if (!row || !Number.isInteger(row.grade) || row.grade < 0 || row.grade > 3)
    throw Error("missing_or_invalid_judgment");
  return row.grade;
}
function ndcg(pid: string, ids: string[]) {
  const dcg = (grades: number[]) =>
    grades
      .slice(0, 5)
      .reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);
  return (
    dcg(ids.map((id) => grade(pid, id))) /
    (dcg(jobs.map((j) => grade(pid, j.id)).sort((a, b) => b - a)) || 1)
  );
}
const rows = profiles.map((p) => {
  const { cv, github } = profile(p.id);
  const a = jobs
    .map((j) => ({ id: j.id, score: match(cv, github, j).score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const v = vector(p.cv);
  const b = jobs
    .map((j) => ({ id: j.id, score: cosine(v, vector(j.text)) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    profile: p.id,
    fit: ndcg(
      p.id,
      a.map((x) => x.id),
    ),
    baseline: ndcg(
      p.id,
      b.map((x) => x.id),
    ),
    fitRanking: a,
    baselineRanking: b,
  };
});
let variants = 0,
  rejected = 0;
const start = performance.now();
for (const p of profiles)
  for (const j of jobs) {
    const { cv, github } = profile(p.id);
    verifyVariant(makeVariant(cv, github, j), cv);
    variants++;
  }
const variantMs = performance.now() - start;
for (let i = 0; i < 1000; i++) {
  const { cv, github } = profile(profiles[i % profiles.length].id);
  const v = makeVariant(cv, github, jobs[i % jobs.length]);
  v.bullets[0].text += " fabricated " + i;
  try {
    verifyVariant(v, cv);
  } catch {
    rejected++;
  }
}
const result = {
  scope:
    "Agent-authored frozen synthetic development labels; NOT independent human validation or hiring outcomes",
  judgments: judgments.length,
  labelsSha256: sha(readFileSync("data/development-labels.json", "utf8")),
  profiles: profiles.length,
  jobs: jobs.length,
  metric: "nDCG@5",
  fit: rows.reduce((s, r) => s + r.fit, 0) / rows.length,
  baseline: rows.reduce((s, r) => s + r.baseline, 0) / rows.length,
  baselinePolicy:
    "Full posting TF-IDF cosine; smoothed IDF over 12 job documents; deterministic ID ties",
  rows,
  variantsVerified: variants,
  variantMs,
  forgedRejected: rejected,
  forgedAttempts: 1000,
  humanValidation: "not measured",
};
writeFileSync(
  "docs/results/benchmark.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
