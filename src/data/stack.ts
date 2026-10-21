import { projects } from "../i18n/projects";

/** Folds product-specific names ("Next.js 16", "Cloudflare D1", "Stripe Connect") into one tool name. */
const normalize = (tech: string) => {
  const name = tech
    .replace(/\s*\(.*\)$/, "")
    .replace(/\s+v?\d+(\.\d+)*$/, "")
    .replace(/ API$/, "");
  if (name.startsWith("Cloudflare")) return "Cloudflare";
  if (name.startsWith("AWS")) return "AWS";
  if (name.startsWith("Stripe")) return "Stripe";
  return name;
};

/** How many of the listed products use each tool, most used first. Derived from projects.ts, not hand-written. */
export const stackUsage = (() => {
  const counts = new Map<string, number>();
  for (const project of projects.en) {
    for (const tool of new Set(project.tech.map(normalize))) {
      counts.set(tool, (counts.get(tool) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
})();

export const projectCount = projects.en.length;
