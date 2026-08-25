import pg from "pg";

/**
 * Пул соединений для серверного кода фронта (getServerSideProps + /api/*).
 *
 * Кэшируется в globalThis: в dev Next пересоздаёт модули на каждый hot-reload, и без кэша
 * пулы копятся до исчерпания `max_connections` у Postgres.
 */
const globalForPool = globalThis as typeof globalThis & {
  __gcnPool?: pg.Pool;
};

const getConnectionString = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL не задан: серверные запросы к Postgres невозможны",
    );
  }

  return connectionString;
};

export const getPool = (): pg.Pool => {
  if (!globalForPool.__gcnPool) {
    globalForPool.__gcnPool = new pg.Pool({
      connectionString: getConnectionString(),
      max: 8,
      idleTimeoutMillis: 30_000,
    });

    globalForPool.__gcnPool.on("error", (error) => {
      console.error("[db] ошибка простаивающего соединения:", error);
    });
  }

  return globalForPool.__gcnPool;
};

export { getConnectionString };
