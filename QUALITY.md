# Fit acceptance report

| Gate | Evidence |
|---|---|
| Hard core written and explained | src/core.ts, docs/DESIGN.md, ADRs |
| One-command fresh clone | docs/results/fresh-clone.json; actual make demo, independent npm cache |
| Live UI | docs/results/browser/proof.json; actual Chromium interactions and four viewport widths |
| Unit + integration + generated cases | make lint test bench; 11 tests; exact-source matrix and deterministic forged variants |
| Measured benchmark | docs/results/benchmark.json; unchanged frozen label SHA256 |
| Caught failure | docs/results/http-proof.json; forged claim, wrong token, stale source; Node 20 failure retained separately |
| ADRs + interview + drill | docs/adr/, INTERVIEW.md, DRILL.md |
| Dependency scans | docs/results/npm-audit.log and python-audit.log |
| CI | Public GitHub Actions; exact final commit verified in root FIT_CI_VERIFICATION.json |
| Honest limits | Independent human ranking validation NOT measured; acceptance partial |

No hosted deployment performed. Docker execution is tested in Linux CI, not on this laptop without Docker. The recorded video has its actual ffprobe duration/hash in docs/results/browser/recording-metadata.json; the large local recording is gitignored. No hiring benefit, real applicant suitability, public-parser extraction accuracy or independent human study is claimed.
