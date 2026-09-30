import { z } from "zod";

/** `KEY=` в env-файле даёт пустую строку — для zod это «не задано», а не значение. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const schema = z
  .object({
    LLM_PROVIDER: optional(z.enum(["ollama", "anthropic"]).default("ollama")),
    OLLAMA_URL: optional(z.url().default("http://localhost:11434")),
    OLLAMA_CHAT_MODEL: optional(z.string().default("qwen3:8b")),
    OLLAMA_EMBED_MODEL: optional(z.string().default("nomic-embed-text")),
    ANTHROPIC_API_KEY: optional(z.string().optional()),
    ANTHROPIC_MODEL: optional(z.string().default("claude-sonnet-5-5")),
    // Не все модели принимают effort (Haiku 4.5 ответит 400). `none` — не передавать:
    // пустую переменную в GitHub Actions не завести
    ANTHROPIC_EFFORT: optional(
      z
        .enum(["low", "medium", "high", "none"])
        .optional()
        .transform((value) => (value === "none" ? undefined : value)),
    ),
  })
  .refine(
    (env) => env.LLM_PROVIDER !== "anthropic" || Boolean(env.ANTHROPIC_API_KEY),
    { message: "LLM_PROVIDER=anthropic требует ANTHROPIC_API_KEY" },
  );

export type LlmConfig = z.infer<typeof schema>;

/**
 * Читается при первом обращении, а не при импорте модуля: `next build` собирает
 * страницы без runtime-env, и ошибка конфигурации чата не должна ронять сборку.
 */
export const readLlmConfig = (): LlmConfig => {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Некорректное окружение AI-чата:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
};
