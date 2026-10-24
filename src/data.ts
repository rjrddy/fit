import { readFileSync } from "node:fs";
import { parseCV, parseGitHub, type Job } from "./core.js";
export type ProfileInput = {
  id: string;
  label: string;
  cv: string;
  github: unknown;
};
export const profiles = JSON.parse(
  readFileSync("data/profiles.json", "utf8"),
) as ProfileInput[];
export const jobs = JSON.parse(readFileSync("data/jobs.json", "utf8")) as Job[];
export function profile(id: string) {
  const raw = profiles.find((p) => p.id === id);
  if (!raw) throw Error("profile_not_found");
  return { raw, cv: parseCV(id, raw.cv), github: parseGitHub(raw.github) };
}
