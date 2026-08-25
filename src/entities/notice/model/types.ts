/**
 * Форма оповещения одна на весь стек: её отдают `getServerSideProps`, `/api/notices` и SSE.
 * Источник правды — серверный слой БД, здесь только реэкспорт, чтобы UI не тянул `@shared/api/db`
 * (там `pg`, в бандл ему нельзя).
 */
export type {
  Notice,
  NoticeCoords,
  NoticeKind,
  NoticesPage,
} from "@shared/api/db/types";
