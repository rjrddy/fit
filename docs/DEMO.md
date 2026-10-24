# A real 90-second demo

From a fresh clone with Node 22.13+: `make demo`; open http://127.0.0.1:18124. Default edit token `local-edit` works only with the loopback default. Synthetic source fixtures and a normalized historical public API snapshot are bundled. No accounts or runtime API call needed.

0–15s: choose Systems & embedded. Explain that the shortlist score is policy-weighted evidence coverage, not a hiring probability. Filter to synthetic evaluation roles.

15–35s: choose a role, inspect required versus preferred clauses, exact CV bullet/span references and gaps. Negative or learning-only mentions receive no positive credit; repo hints are not skill proof. The seniority factor is visible.

35–55s: open Source-only resume, move a source bullet first. Test a fabricated claim: server rejects `unsupported_bullet`. Try a wrong edit token: server rejects it. Restore `local-edit`, verify and save. Download exact-source Markdown and show its SHA256 and synthetic watermark.

55–75s: open Ranking notebook. Explain frozen agent-authored labels, nDCG@5 versus TF-IDF and individual profile results. Independent human validation is **not measured**; acceptance remains partial.

75–90s: filter to the public snapshot and open its original source link. Explain historical data, heuristic extraction, factual normalization, and no raw-prose retention. Reload to show server-backed receipts via the resume panel. Never imply that a listed company uses this project.

Automated recorder: install `requirements-browser.txt` into a virtual environment, run `python -m playwright install chromium ffmpeg`, then `python scripts/review.py --record`. It starts a temporary local server, exercises actual matching/variants/rejection/recovery repeatedly for at least 91 seconds, saves viewport screenshots and JSON receipts under `docs/results/browser/`, and writes video under the gitignored `recording/` directory. Check actual video duration with `ffprobe`; do not pad footage. Use `PLAYWRIGHT_BROWSERS_PATH` for an existing compatible browser cache. `python scripts/review.py` runs the short CI version.

Deployment preparation only: `FIT_TOKEN=<distinct-long-secret> docker compose up --build` binds host loopback and persists `/data` through a named volume. Render Blueprint is a free-tier *ephemeral-storage* preview configuration, not a durable hosted service; receipts are lost on replacement/restart. No account, deployment, service or bill was created. Hosting and TLS require separate authorization.
