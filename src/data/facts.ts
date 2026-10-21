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

const list = projects.en;

/** Numbers shown on the page. All are counted from projects.ts, never typed in by hand. */
export const facts = {
  products: list.length,
  inDevelopment: list.filter((project) => project.status === "In Development").length,
  domains: list.filter((project) => project.url).length,
  tools: new Set(list.flatMap((project) => project.tech.map(normalize))).size,
};
