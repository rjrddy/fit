import { sha, parseRequirements, type Job } from "./core.js";
/** Public GET only. No career-page scraping, auth tokens, application POSTs, or arbitrary URLs. */
export function plainText(input: string): string {
  let text = input;
  for (let i = 0; i < 2; i++)
    text = text.replace(
      /&(?:amp|lt|gt|quot|apos|nbsp|#39|#\d+|#x[0-9a-f]+);/gi,
      (value) => {
        const names: Record<string, string> = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&nbsp;": " ",
          "&#39;": "'",
        };
        const named = names[value.toLowerCase()];
        if (named) return named;
        const n = value.toLowerCase().startsWith("&#x")
          ? parseInt(value.slice(3, -1), 16)
          : parseInt(value.slice(2, -1), 10);
        return Number.isFinite(n) &&
          n > 0 &&
          n <= 0x10ffff &&
          !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : " ";
      },
    );
  return text
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<\/(?:p|li|h[1-6]|div)>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
export function normalizeGreenhouse(
  payload: unknown,
  board: string,
  responseSha256: string,
  fetchedAt: string,
): Job[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { jobs: unknown }).jobs)
  )
    throw Error("invalid_public_feed");
  const rows = (payload as { jobs: unknown[] }).jobs;
  const result: Job[] = [];
  for (const input of rows) {
    const row = input as Record<string, unknown>;
    if (
      !row ||
      typeof row.title !== "string" ||
      !Number.isSafeInteger(row.id) ||
      typeof row.content !== "string" ||
      typeof row.absolute_url !== "string" ||
      !/engineer|developer|software/i.test(row.title)
    )
      continue;
    const url = new URL(row.absolute_url);
    if (url.protocol !== "https:") continue;
    const location = row.location as { name?: unknown } | undefined;
    const temporary: Job = {
      id: "gh-" + String(row.id),
      title: row.title.slice(0, 180),
      company: board,
      location:
        typeof location?.name === "string"
          ? location.name.slice(0, 160)
          : "not specified",
      text: plainText(row.content),
      source: {
        kind: "greenhouse",
        url: url.href,
        synthetic: false,
        fetchedAt,
        responseSha256,
      },
    };
    const parsed = parseRequirements(temporary);
    const required = parsed.requirements.filter((r) => r.kind === "required"),
      preferred = parsed.requirements.filter((r) => r.kind === "preferred");
    // Retain factual terms/metadata, not a copy of third-party job-description prose or contact fields.
    const summarize = (r: (typeof required)[number]) =>
      "- " + r.skills.join(r.mode === "any" ? " or " : " and ") + ".";
    temporary.text =
      "Requirements:\n" +
      required.map(summarize).join("\n") +
      (parsed.minYears === null
        ? ""
        : `\n- At least ${parsed.minYears} years of experience.`) +
      "\nNice to have:\n" +
      preferred.map(summarize).join("\n");
    temporary.warnings = [
      "Public API snapshot, not a current availability guarantee. Section/skill extraction is heuristic; inspect the linked posting.",
      ...parsed.warnings,
    ];
    result.push(temporary);
    if (result.length === 12) break;
  }
  return result;
}
export async function fetchGreenhouse(board: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(board))
    throw Error("invalid_board_token");
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    headers: {
      "User-Agent":
        "FitEvidencePortfolio/0.1 (bounded public GET; no application submission)",
    },
  });
  if (!response.ok)
    throw Error(
      response.status === 429
        ? "public_api_rate_limited"
        : "public_api_unavailable",
    );
  const reader = response.body?.getReader();
  if (!reader) throw Error("empty_public_feed");
  let count = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > 10_000_000) throw Error("public_feed_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const raw = Buffer.concat(chunks),
    digest = sha(raw.toString("utf8")),
    fetchedAt = new Date().toISOString(),
    payload = JSON.parse(raw.toString("utf8"));
  const jobs = normalizeGreenhouse(payload, board, digest, fetchedAt);
  if (!jobs.length) throw Error("no_supported_public_jobs");
  return {
    jobs,
    provenance: {
      url,
      method: "GET",
      status: response.status,
      fetchedAt,
      responseSha256: digest,
      responseBytes: count,
      reportedJobs: Array.isArray(payload.jobs) ? payload.jobs.length : null,
      selectedJobs: jobs.length,
      authentication: "none",
      rawProseRetained: false,
      permissionReference: "https://docs.greenhouse.io/job-board",
      scope:
        "Official public Job Board GET; no HTML scraping or application submission; factual normalized snapshot, not independently checked extraction accuracy",
    },
  };
}
