import { createHash } from "node:crypto";
import {
  canonicalize,
  extractSkills,
  SKILL_PATTERN,
} from "../vendor/career-ops/skill-extract.mjs";
export const sha = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");
export type Span = {
  start: number;
  end: number;
  text: string;
  sourceSha256: string;
  units: "UTF-16 code units";
};
export type Mention = {
  skill: string;
  span: Span;
  polarity: "positive" | "negative" | "learning";
};
export type Bullet = {
  id: string;
  text: string;
  span: Span;
  mentions: Mention[];
};
export type CV = {
  id: string;
  source: string;
  sourceSha256: string;
  years: number | null;
  bullets: Bullet[];
};
export type GitHub = {
  sourceSha256: string;
  login: string;
  repositories: {
    name: string;
    language: string | null;
    eligibleHint: boolean;
    fork: boolean;
    archived: boolean;
  }[];
};
export type Requirement = {
  id: string;
  kind: "required" | "preferred";
  mode: "all" | "any";
  skills: string[];
  line: string;
  span: Span;
};
export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  text: string;
  source: {
    kind: "synthetic" | "greenhouse";
    url: string;
    synthetic: boolean;
    fetchedAt?: string;
    responseSha256?: string;
  };
  requirements?: Requirement[];
  minYears?: number | null;
  warnings?: string[];
};
const extras =
  /(?<!\w)(?:Linux|CMake|pytest|HTML|CSS|POSIX|Embedded systems|signal processing)(?!\w)/gi;
export function mentions(text: string, offset = 0, source = text): Mention[] {
  const found: { skill: string; index: number; raw: string }[] = [];
  for (const match of text.matchAll(
    new RegExp(SKILL_PATTERN.source, SKILL_PATTERN.flags),
  ))
    found.push({
      skill: canonicalize(match[0]),
      index: match.index!,
      raw: match[0],
    });
  for (const match of text.matchAll(extras))
    found.push({
      skill:
        match[0].toLowerCase() === "linux"
          ? "Linux"
          : match[0].toLowerCase() === "cmake"
            ? "CMake"
            : match[0].toLowerCase() === "pytest"
              ? "pytest"
              : match[0].toLowerCase() === "html"
                ? "HTML"
                : match[0].toLowerCase() === "css"
                  ? "CSS"
                  : match[0],
      index: match.index!,
      raw: match[0],
    });
  for (const match of text.matchAll(/(?<!\w)Go(?![\w-])/g))
    found.push({ skill: "Go", index: match.index!, raw: match[0] });
  const learning =
    /\b(?:I am|currently|only)\s+(?:learning|studying)|\bnot (?:yet )?shipped\b/i.test(
      text,
    );
  const negative =
    /\b(?:no|without)\b.*\b(?:experience|knowledge|proficiency)|\b(?:never|not)\s+(?:used|worked|built|shipped)|\bdo not know\b/i.test(
      text,
    );
  return found
    .sort((a, b) => a.index - b.index || a.skill.localeCompare(b.skill))
    .map((m) => ({
      skill: m.skill,
      span: {
        start: m.index + offset,
        end: m.index + offset + m.raw.length,
        text: m.raw,
        sourceSha256: sha(source),
        units: "UTF-16 code units",
      },
      polarity: learning ? "learning" : negative ? "negative" : "positive",
    }));
}
export function parseCV(id: string, source: string): CV {
  if (
    typeof source !== "string" ||
    source.length > 24000 ||
    !source.startsWith("# SYNTHETIC CV") ||
    !/^Synthetic-record: true$/m.test(source)
  )
    throw Error("synthetic_cv_required");
  const bullets: Bullet[] = [];
  const ids = new Set<string>();
  for (const match of source.matchAll(/^- \[([a-zA-Z0-9_-]{1,32})\] (.+)$/gm)) {
    const [, key, text] = match,
      start = match.index! + match[0].length - text.length;
    if (ids.has(key) || text.length > 1200)
      throw Error("invalid_bullet_id_or_length");
    ids.add(key);
    bullets.push({
      id: key,
      text,
      span: {
        start,
        end: start + text.length,
        text,
        sourceSha256: sha(source),
        units: "UTF-16 code units",
      },
      mentions: mentions(text, start, source),
    });
  }
  if (!bullets.length || bullets.length > 40)
    throw Error("bounded_source_bullets_required");
  const years = source.match(/^Experience-years: (\d{1,2})$/m);
  return {
    id,
    source,
    sourceSha256: sha(source),
    years: years ? Number(years[1]) : null,
    bullets,
  };
}
export function parseGitHub(input: unknown): GitHub {
  if (!input || typeof input !== "object")
    throw Error("invalid_github_fixture");
  const value = input as {
    synthetic?: unknown;
    user?: { login?: unknown };
    repos?: unknown[];
  };
  if (
    value.synthetic !== true ||
    typeof value.user?.login !== "string" ||
    !/^demo-[a-z0-9-]{1,40}$/.test(value.user.login) ||
    !Array.isArray(value.repos) ||
    value.repos.length > 100
  )
    throw Error("synthetic_github_required");
  return {
    sourceSha256: sha(JSON.stringify(input)),
    login: value.user.login,
    repositories: value.repos.map((row) => {
      const r = row as Record<string, unknown>;
      if (
        !r ||
        typeof r.name !== "string" ||
        r.name.length > 100 ||
        typeof r.fork !== "boolean" ||
        typeof r.archived !== "boolean" ||
        (r.language !== null && typeof r.language !== "string")
      )
        throw Error("invalid_repository");
      return {
        name: r.name,
        language: r.language as string | null,
        eligibleHint: !r.fork && !r.archived,
        fork: r.fork,
        archived: r.archived,
      };
    }),
  };
}
export function parseRequirements(job: Job): {
  requirements: Requirement[];
  minYears: number | null;
  warnings: string[];
} {
  if (job.requirements)
    return {
      requirements: job.requirements,
      minYears: job.minYears ?? null,
      warnings: job.warnings || [],
    };
  const requirements: Requirement[] = [];
  let kind: "required" | "preferred" | null = null,
    minYears: number | null = null;
  let offset = 0;
  for (const line of job.text.split("\n")) {
    const trim = line.trim();
    if (
      /^(?:requirements|qualifications|minimum qualifications|what you(?:'|’)?ll (?:need|bring)|what you bring|required skills)\s*:?$/i.test(
        trim,
      )
    ) {
      kind = "required";
      offset += line.length + 1;
      continue;
    }
    if (
      /^(?:nice to have|preferred|preferred qualifications|bonus|bonus points)\s*:?$/i.test(
        trim,
      )
    ) {
      kind = "preferred";
      offset += line.length + 1;
      continue;
    }
    if (
      /^(?:about|what you(?:'|’)?ll do|responsibilities|benefits|our team)/i.test(
        trim,
      )
    ) {
      kind = null;
      offset += line.length + 1;
      continue;
    }
    if (kind) {
      if (kind === "required") {
        const years = line.match(/\b(\d{1,2})\s*\+?\s+years?\b/i);
        if (years) minYears = Math.max(minYears || 0, Number(years[1]));
      }
      const skills = [...new Set(mentions(line).map((m) => m.skill))];
      if (skills.length)
        requirements.push({
          id: "r" + (requirements.length + 1),
          kind,
          mode: /\bor\b/i.test(line) ? "any" : "all",
          skills,
          line: trim,
          span: {
            start: offset,
            end: offset + line.length,
            text: line,
            sourceSha256: sha(job.text),
            units: "UTF-16 code units",
          },
        });
    }
    offset += line.length + 1;
  }
  return {
    requirements,
    minYears,
    warnings: requirements.length
      ? []
      : [
          "No supported structured skill requirements found; manual review needed.",
        ],
  };
}
export type SkillEvidence = {
  skill: string;
  status:
    | "cv-backed"
    | "negative"
    | "learning"
    | "conflict"
    | "repo-hint"
    | "missing";
  citations: { bulletId: string; span: Span }[];
  repoHints: string[];
};
export function evidence(cv: CV, github: GitHub, skill: string): SkillEvidence {
  const hits = cv.bullets.flatMap((b) =>
    b.mentions
      .filter((m) => m.skill === skill)
      .map((m) => ({ bulletId: b.id, mention: m })),
  );
  const positive = hits.filter((h) => h.mention.polarity === "positive"),
    negative = hits.filter((h) => h.mention.polarity === "negative"),
    learning = hits.filter((h) => h.mention.polarity === "learning");
  const repoHints = github.repositories
    .filter(
      (r) =>
        r.eligibleHint &&
        r.language &&
        [...extractSkills(r.language)].includes(skill),
    )
    .map((r) => r.name);
  const status =
    positive.length && (negative.length || learning.length)
      ? "conflict"
      : positive.length
        ? "cv-backed"
        : negative.length
          ? "negative"
          : learning.length
            ? "learning"
            : repoHints.length
              ? "repo-hint"
              : "missing";
  return {
    skill,
    status,
    citations: hits.map((h) => ({
      bulletId: h.bulletId,
      span: h.mention.span,
    })),
    repoHints,
  };
}
export function match(cv: CV, github: GitHub, job: Job) {
  const parsed = parseRequirements(job);
  const rows = parsed.requirements.map((r) => {
    const skills = r.skills.map((skill) => evidence(cv, github, skill));
    const supported = skills.filter((s) => s.status === "cv-backed").length;
    return {
      ...r,
      evidence: skills,
      matched: r.mode === "any" ? Number(supported > 0) : supported,
      total: r.mode === "any" ? 1 : skills.length,
    };
  });
  const required = rows.filter((r) => r.kind === "required"),
    preferred = rows.filter((r) => r.kind === "preferred");
  const sum = (items: typeof rows, key: "matched" | "total") =>
    items.reduce((a, r) => a + r[key], 0);
  const requiredTotal = sum(required, "total"),
    preferredTotal = sum(preferred, "total"),
    requiredMatched = sum(required, "matched"),
    preferredMatched = sum(preferred, "matched");
  const denominator = requiredTotal + preferredTotal * 0.25;
  const coverage = denominator
    ? (requiredMatched + preferredMatched * 0.25) / denominator
    : 0;
  const experienceFactor = parsed.minYears
    ? Math.min(1, (cv.years ?? 0) / parsed.minYears)
    : 1;
  const score = requiredTotal
    ? coverage * 100 * experienceFactor
    : (preferredTotal ? (preferredMatched / preferredTotal) * 25 : 0) *
      experienceFactor;
  return {
    jobId: job.id,
    score,
    scoreMeaning:
      "Policy-weighted evidence coverage, not probability of hiring or verified ability",
    coverage,
    experienceFactor,
    cvYears: cv.years,
    minYears: parsed.minYears,
    requiredMatched,
    requiredTotal,
    preferredMatched,
    preferredTotal,
    requirements: rows,
    gaps: rows.flatMap((r) =>
      r.evidence
        .filter((s) => s.status !== "cv-backed")
        .map((s) => ({ requirementId: r.id, kind: r.kind, ...s })),
    ),
    warnings: parsed.warnings,
    sourceSha256: cv.sourceSha256,
  };
}
export type Variant = {
  profileId: string;
  jobId: string;
  sourceSha256: string;
  bullets: {
    id: string;
    text: string;
    start: number;
    end: number;
    sourceSha256: string;
  }[];
};
export function makeVariant(
  cv: CV,
  github: GitHub,
  job: Job,
  order?: string[],
): Variant {
  let ids = order;
  if (!ids) {
    const needs = new Set(
      parseRequirements(job).requirements.flatMap((r) => r.skills),
    );
    ids = [...cv.bullets]
      .sort(
        (a, b) =>
          b.mentions.filter(
            (m) => m.polarity === "positive" && needs.has(m.skill),
          ).length -
            a.mentions.filter(
              (m) => m.polarity === "positive" && needs.has(m.skill),
            ).length || a.id.localeCompare(b.id),
      )
      .map((b) => b.id);
  }
  if (
    ids.length !== cv.bullets.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !cv.bullets.some((b) => b.id === id))
  )
    throw Error("exact_bullet_permutation_required");
  const result: Variant = {
    profileId: cv.id,
    jobId: job.id,
    sourceSha256: cv.sourceSha256,
    bullets: ids.map((id) => {
      const b = cv.bullets.find((b) => b.id === id)!;
      return {
        id: b.id,
        text: b.text,
        start: b.span.start,
        end: b.span.end,
        sourceSha256: cv.sourceSha256,
      };
    }),
  };
  verifyVariant(result, cv);
  return result;
}
export function verifyVariant(
  input: unknown,
  cv: CV,
): asserts input is Variant {
  if (!input || typeof input !== "object") throw Error("invalid_variant");
  const v = input as Variant;
  if (
    Object.keys(v).some(
      (k) => !["profileId", "jobId", "sourceSha256", "bullets"].includes(k),
    ) ||
    typeof v.jobId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(v.jobId)
  )
    throw Error("invalid_variant");
  if (v.profileId !== cv.id || v.sourceSha256 !== cv.sourceSha256)
    throw Error("stale_source");
  if (
    !Array.isArray(v.bullets) ||
    v.bullets.length !== cv.bullets.length ||
    v.bullets.some(
      (b) =>
        !b ||
        typeof b !== "object" ||
        Object.keys(b).some(
          (k) => !["id", "text", "start", "end", "sourceSha256"].includes(k),
        ),
    ) ||
    new Set(v.bullets.map((b) => b.id)).size !== cv.bullets.length
  )
    throw Error("exact_bullet_permutation_required");
  for (const b of v.bullets) {
    const original = cv.bullets.find((x) => x.id === b.id);
    if (
      !original ||
      b.sourceSha256 !== cv.sourceSha256 ||
      b.start !== original.span.start ||
      b.end !== original.span.end ||
      b.text !== original.text ||
      cv.source.slice(b.start, b.end) !== b.text
    )
      throw Error("unsupported_bullet");
  }
}
export function renderVariant(v: Variant, cv: CV): string {
  verifyVariant(v, cv);
  return (
    `# SYNTHETIC RESUME VARIANT — NOT A REAL APPLICANT\n\nSource SHA256: ${cv.sourceSha256}\nTarget fixture/job ID: ${v.jobId}\n\n` +
    v.bullets.map((b) => `- ${b.text}`).join("\n") +
    "\n"
  );
}
