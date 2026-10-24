# Twenty follow-ups grounded in Fit

1. Can a malicious job description instruct the app? It is treated as text data; no model/tool instruction execution exists.
2. Can the feed fetch localhost? Board input is a bounded slug and the request hostname is fixed; redirects are rejected.
3. What if a feed is huge? Streaming stops above 10MB; request timeout is 15 seconds.
4. What if a parser recognizes zero skills? The job gets no skill evidence and a manual-review warning, not an automatic approval.
5. What does `or` do? A recognized alternative line earns at most one unit; this simplistic whole-line rule can misgroup complex clauses.
6. Why cap preferred-only roles? Otherwise a single optional keyword could look like full required coverage. The 25-point cap is policy, not learned truth.
7. How are years interpreted? A numeric required-years clause sets a minimum; a global synthetic CV years field drives a linear capped factor. Skill-specific years are not inferred.
8. What if positive and negative mentions coexist? Evidence becomes conflict and gets no coverage credit.
9. What about `learning Python`? Explicit whole-line learning cues prevent positive support; varied wording can evade the heuristic.
10. Can a fork help the score? No, and archived/forked repos are excluded even as hints.
11. Can a true CV statement be misleading? Yes. Integrity cannot establish real-world truth or fair suitability.
12. Can the variant secretly add a field? The gate rejects unknown variant/bullet keys; Markdown only renders validated fields.
13. How are duplicate bullets handled? IDs must be unique and the complete ID permutation must match the source.
14. What if an offset changes but text stays equal? The exact original offset is required; duplicate text elsewhere cannot substitute.
15. Does SQLite make this distributed? No. There is no replicated state, tenant isolation or failover design.
16. What stops unauthenticated writes? Bearer edit token enforced on POST; public binding refuses the loopback default. Reads contain synthetic data only.
17. Are errors safe? Fixed error-code responses do not echo malformed bodies, tokens or CV content; HTTP proof checks canaries in logs.
18. Is the ranking result statistically significant? Not established. The small subjective development set is neither independent nor held out.
19. Is the public snapshot current? Only at its recorded fetch time; postings may change or disappear. Extraction quality is unmeasured.
20. Why no hosted URL? Only deployment preparation was authorized. Free Render storage is ephemeral; Compose provides an explicit local volume.
