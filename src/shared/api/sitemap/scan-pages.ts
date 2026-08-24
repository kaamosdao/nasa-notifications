import type { SitemapCollection } from "./types";

import fs from "node:fs";
import path from "node:path";

const PAGES_DIR = path.join(process.cwd(), "src/pages");

const SKIP_FILES = new Set([
  "_app",
  "_document",
  "_error",
  "404",
  "500",
  "robots.txt",
  ".keep",
]);

const PAGE_EXT = /\.(tsx|ts|jsx|js)$/;

const isDynamicSegment = (segment: string) =>
  segment.startsWith("[") && segment.endsWith("]");

const isSlugPageFile = (baseName: string) => baseName === "[slug]";

type WalkResult = {
  staticPaths: string[];
  conventionCollections: SitemapCollection[];
};

function walk(dir: string, routeSegments: string[], out: WalkResult): void {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;

    if (name === "api" || name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      // Пропускаем catch-all / optional catch-all и прочие динамические папки
      // без отдельной конвенции (кроме файла [slug].tsx на уровень выше).
      if (isDynamicSegment(name)) continue;

      walk(path.join(dir, name), [...routeSegments, name], out);
      continue;
    }

    if (!PAGE_EXT.test(name)) continue;

    const baseName = name.replace(PAGE_EXT, "");

    // Конвенция: src/pages/<uid>/[slug].tsx → коллекция uid, path /uid/:slug
    if (isSlugPageFile(baseName)) {
      if (routeSegments.length === 0) continue;
      const uid = routeSegments[routeSegments.length - 1];
      const prefix = `/${routeSegments.join("/")}`;
      out.conventionCollections.push({
        uid,
        toPath: (slug) => `${prefix}/${slug}`,
      });
      continue;
    }

    if (
      SKIP_FILES.has(baseName) ||
      baseName.endsWith(".xml") ||
      isDynamicSegment(baseName)
    ) {
      continue;
    }

    if (baseName === "index") {
      const route =
        routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
      out.staticPaths.push(route);
      continue;
    }

    out.staticPaths.push(`/${[...routeSegments, baseName].join("/")}`);
  }
}

/**
 * Умный обход `src/pages`: статические пути + коллекции по конвенции `[slug].tsx`.
 */
export function scanPages(): WalkResult {
  const out: WalkResult = { staticPaths: [], conventionCollections: [] };
  walk(PAGES_DIR, [], out);
  out.staticPaths.sort();
  return out;
}
