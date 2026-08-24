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

type WalkResult = {
  staticPaths: string[];
};

function walk(dir: string, routeSegments: string[], out: WalkResult): void {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;

    if (name === "api" || name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      // Динамические сегменты пропускаем: публичных URL с параметрами в проекте нет.
      if (isDynamicSegment(name)) continue;

      walk(path.join(dir, name), [...routeSegments, name], out);
      continue;
    }

    if (!PAGE_EXT.test(name)) continue;

    const baseName = name.replace(PAGE_EXT, "");

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

/** Обход `src/pages`: статические маршруты для карты сайта. */
export function scanPages(): WalkResult {
  const out: WalkResult = { staticPaths: [] };
  walk(PAGES_DIR, [], out);
  out.staticPaths.sort();
  return out;
}
