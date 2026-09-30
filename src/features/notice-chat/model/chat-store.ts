import { createStore } from "zustand/vanilla";

import { MAX_HISTORY } from "@shared/api/chat/schema";

import { ChatError, streamChat } from "../api/stream-chat";
import type { ChatMessage } from "./types";

export type ChatStatus = "idle" | "streaming";

/** `question` — чтобы повторить вопрос: неудачная пара из истории уже удалена. */
export type ChatFailure = { message: string; question: string };

export type NoticeChatState = {
  messages: ChatMessage[];
  status: ChatStatus;
  error: ChatFailure | null;
  actions: {
    ask: (question: string) => void;
    /** Остановить ответ: сервер по обрыву соединения прекращает генерацию. */
    stop: () => void;
  };
};

export type NoticeChatStore = ReturnType<typeof createNoticeChatStore>;

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

let lastId = 0;
const nextId = () => String(++lastId);

/**
 * Стор диалога живёт вместе с модалкой: закрыли — история пропала, на сервере её нет.
 * Незавершённая пара «вопрос — пустой ответ» из истории удаляется, чтобы следующий запрос
 * прошёл схему API (реплики чередуются, ответ не пустой).
 */
export const createNoticeChatStore = (noticeId: string) => {
  let controller: AbortController | null = null;

  return createStore<NoticeChatState>()((set, get) => {
    const updateAnswer = (id: string, patch: Partial<ChatMessage>) =>
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      }));

    const finish = (answerId: string, error: ChatFailure | null) => {
      controller = null;
      set((state) => {
        const answer = state.messages.at(-1);
        const isEmpty = answer?.id === answerId && !answer.content.trim();

        return {
          status: "idle",
          error,
          messages: isEmpty ? state.messages.slice(0, -2) : state.messages,
        };
      });
    };

    return {
      messages: [],
      status: "idle",
      error: null,
      actions: {
        ask: (question) => {
          const content = question.trim();

          if (!content || get().status === "streaming") {
            return;
          }

          const answerId = nextId();
          // Нечётный срез чередующейся истории всегда начинается с вопроса
          const history = [
            ...get().messages,
            { id: nextId(), role: "user" as const, content },
          ].slice(-(MAX_HISTORY + 1));

          controller = new AbortController();
          const { signal } = controller;

          set((state) => ({
            status: "streaming",
            error: null,
            messages: [
              ...state.messages,
              ...history.slice(-1),
              { id: answerId, role: "assistant", content: "" },
            ],
          }));

          streamChat({
            noticeId,
            messages: history.map(({ role, content }) => ({ role, content })),
            signal,
            onSources: (sources) => updateAnswer(answerId, { sources }),
            onDelta: (text) =>
              set((state) => ({
                messages: state.messages.map((message) =>
                  message.id === answerId
                    ? { ...message, content: message.content + text }
                    : message,
                ),
              })),
          })
            .then(() => finish(answerId, null))
            .catch((error: unknown) => {
              if (signal.aborted) {
                finish(answerId, null);
                return;
              }

              finish(answerId, {
                message:
                  error instanceof ChatError ? error.message : UNEXPECTED_ERROR,
                question: content,
              });
            });
        },
        stop: () => controller?.abort(),
      },
    };
  });
};
