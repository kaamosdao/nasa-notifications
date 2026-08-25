import { logger } from "../logger.js";
import { pool } from "./pool.js";

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// `src/db/` в dev и `dist/db/` в сборке лежат на одном уровне — путь до sql/ общий.
const SQL_DIR = fileURLToPath(new URL("../../sql", import.meta.url));

/**
 * Прогоняет .sql из sql/ по алфавиту, по одному разу на файл.
 * Отдельной библиотеки миграций не заводим: файлы идемпотентны и их единицы.
 */
export const migrate = async () => {
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(SQL_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const { rows } = await client.query<{ name: string }>(
      "select name from schema_migrations",
    );
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(`${SQL_DIR}/${file}`, "utf8");

      await client.query("begin");

      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [
          file,
        ]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }

      logger.info("Миграция применена", { file });
    }
  } finally {
    client.release();
  }
};
