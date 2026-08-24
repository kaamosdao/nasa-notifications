import type { SitemapEntry } from "./types";

export const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(({ loc, lastmod }) => {
      const mod = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `<url><loc>${escapeXml(loc)}</loc>${mod}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
