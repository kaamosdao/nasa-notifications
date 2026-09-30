import { z } from "zod";

export const MAX_QUESTION_LENGTH = 1000;

/** Реплик истории до текущего вопроса; старше — клиент обрезает сам. */
export const MAX_HISTORY = 10;

/** Ответ модели длиннее не бывает (промпт + потолок токенов) — больше только подделка. */
const MAX_ANSWER_LENGTH = 8000;

const message = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
  }),
]);

/**
 * Тело `POST /api/chat`. История хранится только на клиенте и приходит целиком: реплики
 * чередуются, первая и последняя — вопросы пользователя.
 */
export const chatRequestSchema = z.object({
  noticeId: z.string().regex(/^\d+$/),
  messages: z
    .array(message)
    .min(1)
    .max(MAX_HISTORY + 1)
    .refine(
      (messages) =>
        messages.length % 2 === 1 &&
        messages.every(
          ({ role }, index) => role === (index % 2 ? "assistant" : "user"),
        ),
      { message: "Реплики должны чередоваться, начиная и заканчивая вопросом" },
    ),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;
