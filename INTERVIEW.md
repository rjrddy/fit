# Fit interview kit

## Two-minute pitch
Fit makes job matching inspectable. It parses synthetic CV bullets and GitHub-shaped repository metadata, extracts explicit requirements from synthetic jobs or a normalized official public feed, and shows each skill with an exact source span or an explicit gap. The score is an explainable coverage policy, not a probability of getting hired. Repository hints never become CV evidence.

The hardest guarantee is resume integrity. Rather than ask a model to invent polished claims, Fit only rearranges all original bullets. A server-side gate checks IDs, exact text, offsets, source hashes and completeness before a SQLite receipt is committed. The development benchmark compares the policy with TF-IDF on frozen agent-authored grades; it is not independent human validation. Actual results are in docs/results/benchmark.json. HTTP and browser evidence show both fabricated-claim rejection and successful recovery.

## Ten-minute architecture walkthrough
Minutes 0–2: show synthetic inputs in data/profiles.json and data/jobs.json, plus the public-feed receipt. Explain why no real applicant data or personalized career-ops files were imported. The MIT extractor is a small explicit reuse boundary.

Minutes 2–4: follow parseCV → mentions → evidence. SHA256 hashes UTF-8 source bytes; offsets are JavaScript UTF-16 units. Positive/negative conflicts receive no credit. Language metadata is a separate hint. Walk through a negative experience sentence and an excluded fork.

Minutes 4–6: follow parseRequirements → match. Heading-based clauses, all/any groups, required/preferred weights and experience factor are explicit and intentionally approximate. Unknown requirements need manual review; absence of a recognized clause is not approval.

Minutes 6–8: follow makeVariant → verifyVariant → INSERT → response. Complete source permutations prevent novel claims. The HTTP service bounds JSON, authenticates writes, returns fixed safe error codes and serves the original React workspace. SQLite acknowledgments follow committed statements.

Minutes 8–10: show the TF-IDF benchmark, per-profile results and immutable label hash. Demonstrate fabricated text rejection, wrong-token rejection, a valid receipt and restart persistence. Explain limits: synthetic subjective development set, lexical parser, single-instance storage and no hosted service.

## Five tradeoffs
1. Exact permutation over rewriting: strong traceability, limited tailoring.
2. Lexical clauses over a model: deterministic and cheap, limited semantic coverage.
3. Separate repository hints over proficiency inference: fewer unsupported claims, less ranking signal.
4. Factual public snapshot over raw prose: less third-party retention, weaker historical extraction reproducibility.
5. SQLite over a distributed database: easy reproducibility, single-instance durability and no tenant isolation.

## Five failure modes
1. Forged achievement: exact text/span gate rejects it; HTTP proof records the error.
2. Stale source revision: hash mismatch returns 409 instead of accepting outdated citations.
3. Skill mentioned negatively: no positive evidence credit; complicated mixed clauses remain a parser limitation.
4. Unavailable/rate-limited feed: bounded official GET fails; bundled snapshot keeps the demo runnable, without freshness claims.
5. Lost host storage: Compose volume survives container replacement if retained; Render free ephemeral preview does not. No HA or power-loss guarantee.

## Fifteen likely questions
1. What does the score mean? A weighted fraction of recognized skill units supported by positive CV mentions, multiplied by an experience factor.
2. Is 90 a hiring probability? No; there is no hiring-outcome calibration.
3. Why not use GitHub languages as proof? A language statistic does not establish authorship, proficiency or work experience.
4. What was reused? The reviewed MIT public career-ops skill alias module and its license, not any personal data or full workflow.
5. Why not extend the exact requested checkout? No directory named career-ops-juiced was found in the recorded scope; a related dirty fork was preserved untouched.
6. What makes a bullet supported? Exact equality to a current source bullet, with matching ID, offsets and source hash. That proves integrity, not factual truth.
7. Can a variant omit a negative statement? No. All bullets remain in a complete permutation.
8. Why UTF-16 offsets? JavaScript slicing uses those units. Hashing separately uses UTF-8 bytes; tests include an emoji.
9. What is the baseline? Full-posting TF-IDF cosine with smoothed document frequency and deterministic job-ID ties.
10. Are the labels independent? No. They are agent-authored development grades frozen before implementation; independent human evaluation is missing.
11. Did you tune against the measured comparison? The declared scorer and label set were implemented before the first benchmark; no grades were changed to improve results.
12. Why publish per-profile results? Aggregate means can hide regressions and subjective disagreement.
13. What API permission is used? The documented unauthenticated Greenhouse Job Board GET endpoint; no application POST or scraping.
14. What survives a crash? The tested receipt survives a clean process restart. Power loss, multiple active writers and host-volume loss are not established by that test.
15. What did the browser verify? Actual matching, source filtering, evidence, variant ordering, fabricated-claim and token rejection, recovery, download availability, public source links, focus and four viewport widths. See actual proof JSON.

## Three more months
Collect independently labeled consented/synthetic cases with blinded baselines and held-out templates. Improve requirement structure and mixed-negation handling before adding learned ranking. Build a private local importer, separate user authorization and storage encryption. Add backups/restore drills, a real accessibility audit, and source-preserving editing only after claim-level equivalence can be validated. Keep applications under deliberate human control.
