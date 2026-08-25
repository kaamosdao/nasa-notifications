type Level = "info" | "warn" | "error";

const write = (
  level: Level,
  message: string,
  meta?: Record<string, unknown>,
) => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "ingestor",
    message,
    ...meta,
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("error", message, meta),
};
