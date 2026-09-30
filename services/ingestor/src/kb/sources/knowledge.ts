import { z } from "zod";

import type { KbDocument } from "../types.js";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** services/ingestor/knowledge — одинаково из src/ (tsx) и dist/ (node). */
const KNOWLEDGE_DIR = fileURLToPath(
  new URL("../../../knowledge/", import.meta.url),
);

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;

const frontMatterSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(["gw", "grb", "frb", "neutrino", "circular"]).optional(),
  topics: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .default([]),
  url: z.url().optional(),
});

/** Плоский `key: value` без вложенности: полноценный YAML-парсер ради четырёх полей не нужен. */
const parseFrontMatter = (block: string): Record<string, string> =>
  Object.fromEntries(
    block
      .split("\n")
      .map((line) => line.match(/^(\w+):\s*(.*)$/))
      .filter((match) => match !== null)
      .map(([, key, value]) => [key, value?.trim()]),
  );

const parseArticle = (fileName: string, raw: string): KbDocument => {
  const match = raw.match(FRONT_MATTER);

  if (!match?.[1]) {
    throw new Error(`${fileName}: нет front matter`);
  }

  const meta = frontMatterSchema.safeParse(parseFrontMatter(match[1]));

  if (!meta.success) {
    throw new Error(`${fileName}: ${z.prettifyError(meta.error)}`);
  }

  return {
    source: "knowledge",
    sourceId: path.basename(fileName, ".md"),
    kind: meta.data.kind ?? null,
    topics: meta.data.topics,
    eventName: null,
    title: meta.data.title,
    url: meta.data.url ?? null,
    content: raw.slice(match[0].length).trim(),
    publishedAt: null,
  };
};

/**
 * Справочные статьи из knowledge/*.md. Битая статья роняет загрузку целиком:
 * это наш контент, ошибку надо увидеть сразу, а не потерять строку в логе.
 */
export const readKnowledge = async (): Promise<KbDocument[]> => {
  const files = (await readdir(KNOWLEDGE_DIR))
    .filter((name) => name.endsWith(".md"))
    .sort();

  return Promise.all(
    files.map(async (name) =>
      parseArticle(
        name,
        await readFile(path.join(KNOWLEDGE_DIR, name), "utf8"),
      ),
    ),
  );
};
