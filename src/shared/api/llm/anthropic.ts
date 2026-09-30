import Anthropic from "@anthropic-ai/sdk";

import type { LlmProvider } from "./types";

/**
 * Потолок, а не целевая длина: на моделях с размышлениями (Sonnet 5.5 и Opus 5.5 думают по умолчанию)
 * токены размышлений входят в max_tokens, и тесный лимит обрезал бы сам ответ.
 * Длину ответа задаёт системный промпт.
 */
const MAX_TOKENS = 4096;

type AnthropicOptions = {
  apiKey: string;
  model: string;
  effort?: "low" | "medium" | "high";
};

export const createAnthropicProvider = ({
  apiKey,
  model,
  effort,
}: AnthropicOptions): LlmProvider => {
  const client = new Anthropic({ apiKey });

  return {
    async *streamChat({ system, messages, signal }) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: MAX_TOKENS,
          // системный промпт одинаков у всех запросов — кэшируется, повтор ~10% цены
          system: [
            {
              type: "text",
              text: system,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages,
          ...(effort && { output_config: { effort } }),
        },
        { signal },
      );

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },
  };
};
