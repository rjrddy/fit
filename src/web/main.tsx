import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type Row = {
  id: string;
  title: string;
  company: string;
  source: { kind: string; url: string };
  text: string;
  result: {
    score: number;
    requiredMatched: number;
    requiredTotal: number;
    minYears: number | null;
    experienceFactor: number;
    requirements: any[];
    warnings: string[];
  };
};
function App() {
  const [profiles, setProfiles] = useState<{ id: string; label: string }[]>([]),
    [pid, setPid] = useState("systems"),
    [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState(""),
    [cv, setCv] = useState<any>(null),
    [tab, setTab] = useState("evidence"),
    [order, setOrder] = useState<string[]>([]),
    [token, setToken] = useState("local-edit"),
    [notice, setNotice] = useState(""),
    [markdown, setMarkdown] = useState(""),
    [metrics, setMetrics] = useState<any>(null),
    [filter, setFilter] = useState("all"),
    [history, setHistory] = useState<any[]>([]);
  async function load() {
    const s = await fetch("/api/state").then((r) => r.json());
    setProfiles(s.profiles);
    setMetrics(s.metrics);
    const h = await fetch("/api/history").then((r) => r.json());
    setHistory(h);
  }
  useEffect(() => {
    load().catch(() => setNotice("Unable to load. Check the local server."));
  }, []);
  useEffect(() => {
    fetch("/api/match?profile=" + encodeURIComponent(pid))
      .then((r) => r.json())
      .then((d) => {
        setRows(d.ranked);
        setCv(d.cv);
        setOrder(d.cv.bullets.map((b: any) => b.id));
        setSelected(d.ranked[0].id);
        setMarkdown("");
      })
      .catch(() => setNotice("Matching failed."));
  }, [pid]);
  const job = rows.find((r) => r.id === selected);
  const shown = rows.filter(
    (r) => filter === "all" || r.source.kind === filter,
  );
  async function save(forge = false) {
    setNotice("");
    try {
      let input: any = { profileId: pid, jobId: selected, order };
      if (forge) {
        input.variant = {
          profileId: pid,
          jobId: selected,
          sourceSha256: cv.sourceSha256,
          bullets: cv.bullets.map((b: any, i: number) => ({
            id: b.id,
            text: b.text + (i === 0 ? " Managed a fabricated team." : ""),
            start: b.span.start,
            end: b.span.end,
            sourceSha256: cv.sourceSha256,
          })),
        };
      }
      const r = await fetch("/api/variant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + token,
        },
        body: JSON.stringify(input),
      });
      const data = await r.json();
      if (!r.ok) {
        setNotice("Rejected: " + data.error);
        return;
      }
      setMarkdown(data.markdown);
      setNotice(
        "Receipt #" +
          data.id +
          " · exact source permutation verified and saved",
      );
      await load();
    } catch {
      setNotice("Connection failed. Retry after checking the server.");
    }
  }
  function move(id: string) {
    setOrder([id, ...order.filter((x) => x !== id)]);
    setMarkdown("");
  }
  return (
    <>
      <aside className="rail">
        <a className="brand" href="/">
          f<span>i</span>t.
        </a>
        <div className="vertical">EVIDENCE BEFORE CONFIDENCE</div>
        <span className="rail-end">LOCAL / 01</span>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">A SHORTLIST WITH RECEIPTS</p>
            <h1>
              Good fit?
              <br />
              <em>Show your work.</em>
            </h1>
          </div>
          <div className="identity">
            <label htmlFor="profile">SYNTHETIC CANDIDATE</label>
            <select
              id="profile"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p>No real applicants. No applications sent.</p>
          </div>
        </header>
        <div className="disclosure">
          <b>DEVELOPMENT WORKSPACE</b>
          <span>
            Scores measure source coverage, not hiring probability. Independent
            human ranking validation: not measured.
          </span>
        </div>
        <div className="workspace">
          <section className="shortlist">
            <div className="section-head">
              <h2>01 / Shortlist</h2>
              <span>{shown.length} ROLES</span>
            </div>
            <label className="filter">
              Source
              <select
                aria-label="Posting source"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                <option value="synthetic">Synthetic evaluation</option>
                <option value="greenhouse">Public API snapshot</option>
              </select>
            </label>
            <div className="jobs">
              {shown.map((r, i) => (
                <button
                  className={"job " + (selected === r.id ? "active" : "")}
                  key={r.id}
                  onClick={() => {
                    setSelected(r.id);
                    setMarkdown("");
                  }}
                >
                  <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <small>
                      {r.source.kind === "synthetic"
                        ? "SYNTHETIC"
                        : r.company + " / PUBLIC SNAPSHOT"}
                    </small>
                    <strong>{r.title}</strong>
                  </span>
                  <b>
                    {r.result.score.toFixed(0)}
                    <small>/100</small>
                  </b>
                </button>
              ))}
            </div>
          </section>
          <section className="detail">
            {job && cv && (
              <>
                <div className="job-head">
                  <p className="eyebrow">02 / REQUIREMENT REVIEW</p>
                  <h2>{job.title}</h2>
                  <div className="scoreline">
                    <b>
                      {job.result.requiredMatched}/{job.result.requiredTotal}
                    </b>
                    <span>
                      required skill units supported by CV text
                      <br />
                      Experience factor {job.result.experienceFactor.toFixed(
                        2,
                      )}{" "}
                      · minimum years {job.result.minYears ?? "unspecified"}
                    </span>
                  </div>
                  {job.source.kind === "greenhouse" && (
                    <p className="snapshot">
                      Historical normalized API snapshot; extraction accuracy
                      not measured.{" "}
                      <a href={job.source.url} target="_blank" rel="noreferrer">
                        Review original posting ↗
                      </a>
                    </p>
                  )}
                </div>
                <nav aria-label="Review panels">
                  {["evidence", "resume", "evaluation"].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "chosen" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t === "evidence"
                        ? "Evidence & gaps"
                        : t === "resume"
                          ? "Source-only resume"
                          : "Ranking notebook"}
                    </button>
                  ))}
                </nav>
                {tab === "evidence" && (
                  <div className="evidence">
                    {!job.result.requirements.length && (
                      <p>No recognized requirements. Manual review required.</p>
                    )}
                    {job.result.requirements.map((r) => (
                      <article key={r.id}>
                        <div className="req-title">
                          <small>
                            {r.kind.toUpperCase()} /{" "}
                            {r.mode === "any" ? "ANY ONE" : "ALL"}
                          </small>
                          <h3>{r.line}</h3>
                        </div>
                        {r.evidence.map((e: any) => (
                          <div className="evidence-row" key={e.skill}>
                            <b>{e.skill}</b>
                            <span className={"status " + e.status}>
                              {e.status}
                            </span>
                            <div>
                              {e.citations.length ? (
                                e.citations.map((c: any) => (
                                  <p key={c.bulletId + c.span.start}>
                                    <code>
                                      {c.bulletId} · {c.span.start}:{c.span.end}
                                    </code>
                                    <q>
                                      {
                                        cv.bullets.find(
                                          (b: any) => b.id === c.bulletId,
                                        )?.text
                                      }
                                    </q>
                                  </p>
                                ))
                              ) : (
                                <p>No supporting CV span.</p>
                              )}
                              {e.repoHints.length > 0 && (
                                <p>
                                  Repository metadata hint:{" "}
                                  {e.repoHints.join(", ")}. Does not earn CV
                                  credit.
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </article>
                    ))}
                    {job.result.warnings.map((w) => (
                      <p className="snapshot" key={w}>
                        {w}
                      </p>
                    ))}
                  </div>
                )}
                {tab === "resume" && (
                  <section className="resume">
                    <p>
                      Reorder exact source bullets. Every bullet stays; no
                      rewritten claims, new achievements or job-description
                      text.
                    </p>
                    <div className="sourcehash">
                      CV SHA256 {cv.sourceSha256}
                    </div>
                    {order.map((id) => (
                      <div className="bullet" key={id}>
                        <code>{id}</code>
                        <p>{cv.bullets.find((b: any) => b.id === id)?.text}</p>
                        <button
                          onClick={() => move(id)}
                          aria-label={"Move " + id + " first"}
                        >
                          ↑ First
                        </button>
                      </div>
                    ))}
                    <label>
                      Edit token
                      <input
                        aria-label="Edit token"
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                    </label>
                    <div className="actions">
                      <button className="primary" onClick={() => save()}>
                        Verify & save variant ↗
                      </button>
                      <button onClick={() => save(true)}>
                        Test a fabricated claim
                      </button>
                    </div>
                    {markdown && (
                      <>
                        <pre>{markdown}</pre>
                        <a
                          className="download"
                          download="synthetic-resume.md"
                          href={
                            "data:text/markdown;charset=utf-8," +
                            encodeURIComponent(markdown)
                          }
                        >
                          Download verified Markdown ↓
                        </a>
                      </>
                    )}
                    <p>
                      {history.length} recent persisted receipts (maximum 30
                      displayed).
                    </p>
                  </section>
                )}
                {tab === "evaluation" && (
                  <section className="notebook">
                    <h3>
                      A development comparison.
                      <br />
                      Not a hiring study.
                    </h3>
                    {metrics ? (
                      <>
                        <div className="metric-pair">
                          <div>
                            <span>Evidence policy · nDCG@5</span>
                            <b>{metrics.fit.toFixed(3)}</b>
                          </div>
                          <div>
                            <span>TF-IDF baseline · nDCG@5</span>
                            <b>{metrics.baseline.toFixed(3)}</b>
                          </div>
                        </div>
                        <p>
                          {metrics.judgments} agent-authored relevance judgments
                          across {metrics.profiles} synthetic profiles and{" "}
                          {metrics.jobs} synthetic jobs. Labels frozen before
                          implementation. No independent human labels or
                          held-out data.
                        </p>
                        <table>
                          <thead>
                            <tr>
                              <th>Profile</th>
                              <th>Fit</th>
                              <th>TF-IDF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.rows.map((r: any) => (
                              <tr key={r.profile}>
                                <td>{r.profile}</td>
                                <td>{r.fit.toFixed(3)}</td>
                                <td>{r.baseline.toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p>
                          {metrics.variantsVerified} exact-source variants
                          verified; {metrics.forgedRejected}/
                          {metrics.forgedAttempts} altered-text controls
                          rejected. This checks source integrity, not truth of
                          the source.
                        </p>
                      </>
                    ) : (
                      <p>Run make bench to measure this notebook.</p>
                    )}
                  </section>
                )}
              </>
            )}
          </section>
        </div>
        <div
          role="status"
          className={"notice " + (notice.startsWith("Rejected") ? "error" : "")}
        >
          {notice ||
            "Source integrity is testable. Real-world suitability still needs a person."}
        </div>
        <footer>
          <span>FIT / SYNTHETIC RECORDS ONLY</span>
          <span>NO AUTOFILL · NO SCRAPING · NO INVENTED EXPERIENCE</span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
