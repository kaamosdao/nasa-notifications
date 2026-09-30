import { z } from "zod";

const limit = (fallback: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(fallback),
  );

const schema = z.object({
  CHAT_RATE_PER_MIN: limit(10),
  CHAT_RATE_PER_DAY: limit(50),
  CHAT_DAILY_CAP: limit(1000),
});

export type ChatLimits = {
  perMinute: number;
  perDay: number;
  dailyCap: number;
};

/** Читается при первом запросе, а не при импорте: `next build` идёт без runtime-env. */
export const readChatLimits = (): ChatLimits => {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Некорректные лимиты AI-чата:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return {
    perMinute: parsed.data.CHAT_RATE_PER_MIN,
    perDay: parsed.data.CHAT_RATE_PER_DAY,
    dailyCap: parsed.data.CHAT_DAILY_CAP,
  };
};
