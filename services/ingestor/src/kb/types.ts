import type { NoticeKind } from "../parsers/index.js";

/**
 * Документ базы знаний до нарезки на чанки: курируемая статья или GCN Circular.
 * Поля повторяют колонки kb_chunks (002-rag.sql, 003-kb-topics.sql, 004-kb-doc-hash.sql).
 */
export type KbDocument = {
  source: "knowledge" | "circular";
  /** Имя файла статьи без расширения или номер циркуляра. */
  sourceId: string;
  /** Тип событий, к которым относится документ: по нему к notice подбирается справка. */
  kind: NoticeKind | null;
  /** Префиксы Kafka-топиков, к notice которых относится статья. */
  topics: string[];
  /** Имя события в виде notice: 'GRB 250706A', 'S250206dm', 'IceCube-250708A'. */
  eventName: string | null;
  title: string;
  url: string | null;
  content: string;
  publishedAt: string | null;
};
