/**
 * Форма источников — из серверного слоя чата; импорт только типа, серверный код в бандл
 * не попадает.
 */
import type { ChatSource } from "@shared/api/chat/prompt";

export type { ChatSource };

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** Только у ответа: приходят до первого токена. */
  sources?: ChatSource[];
};
