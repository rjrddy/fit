import { test } from "node:test";
import assert from "node:assert/strict";
import { profiles, jobs, profile } from "../src/data.js";
import {
  match,
  makeVariant,
  verifyVariant,
  renderVariant,
  evidence,
  parseCV,
  parseGitHub,
  mentions,
  parseRequirements,
} from "../src/core.js";
test("all profile/job variants retain exact source bullets and offsets", () => {
  for (const p of profiles)
    for (const j of jobs) {
      const { cv, github } = profile(p.id);
      const v = makeVariant(cv, github, j);
      verifyVariant(v, cv);
      for (const b of v.bullets) {
        assert.equal(cv.source.slice(b.start, b.end), b.text);
        assert.ok(renderVariant(v, cv).includes(b.text));
      }
    }
});
test("1000 deterministic forged variants fail closed", () => {
  const { cv, github } = profile("systems");
  for (let i = 0; i < 1000; i++) {
    const v = makeVariant(cv, github, jobs[i % jobs.length]);
    switch (i % 4) {
      case 0:
        v.bullets[0].text += " Led 40 engineers";
        break;
      case 1:
        v.bullets[0].start++;
        break;
      case 2:
        v.sourceSha256 = "0".repeat(64);
        break;
      case 3:
        v.bullets[1] = v.bullets[0];
    }
    assert.throws(() => verifyVariant(v, cv));
  }
});
test("negated experience and learning do not count as evidence", () => {
  let p = profile("systems");
  assert.equal(evidence(p.cv, p.github, "Kubernetes").status, "negative");
  p = profile("frontend");
  assert.notEqual(evidence(p.cv, p.github, "SQL").status, "cv-backed");
});
test("fork metadata never earns source proof", () => {
  const p = profile("systems");
  assert.notEqual(evidence(p.cv, p.github, "Rust").status, "cv-backed");
  assert.equal(evidence(p.cv, p.github, "Rust").repoHints.length, 0);
});
test("requirements exclude company keyword bait; seniority penalizes", () => {
  const p = profile("systems");
  const trap = jobs.find((j) => j.id === "keyword-trap")!;
  assert.equal(match(p.cv, p.github, trap).score, 0);
  assert.ok(
    match(
      p.cv,
      p.github,
      jobs.find((j) => j.id === "staff-systems")!,
    ).experienceFactor < 1,
  );
});
test("synthetic inputs required and spans use UTF16", () => {
  assert.throws(() => parseCV("x", "real CV"));
  assert.throws(() => parseGitHub({ synthetic: false }));
  const src = "# SYNTHETIC CV\nSynthetic-record: true\n- [a] 🧪 Python";
  const cv = parseCV("x", src);
  assert.equal(
    src.slice(
      cv.bullets[0].mentions[0].span.start,
      cv.bullets[0].mentions[0].span.end,
    ),
    "Python",
  );
});
test("ordinary go is not Go; alternative clauses are explicit", () => {
  assert.equal(mentions("go outside").length, 0);
  const p = parseRequirements({
    ...jobs[0],
    requirements: undefined,
    text: "Requirements:\nPython or JavaScript",
  });
  assert.equal(p.requirements[0].mode, "any");
});
