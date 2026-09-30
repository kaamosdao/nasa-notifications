"use client";

import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { gsap } from "gsap";
import { useStore } from "zustand";

import type { Notice } from "@entities/notice";

import { MAX_QUESTION_LENGTH } from "@shared/api/chat/schema";
import { prefersReducedMotion } from "@shared/utils/prefers-reduced-motion";

import { createNoticeChatStore } from "../../model/chat-store";
import { ChatMarkdown } from "../chat-markdown";

import s from "./notice-chat-dialog.module.scss";

/** Подсказки одинаковые для всех типов; уточнения — через поле ввода. */
const SUGGESTIONS = [
  { label: "What is this?", question: "What is this?" },
  { label: "Why does it matter?", question: "Why does it matter?" },
  {
    label: "About the research",
    question: "What do follow-up observations and research say about it?",
  },
];

/** Дальше этого от низа считаем, что пользователь перечитывает ответ, и не дёргаем скролл. */
const BOTTOM_THRESHOLD = 80;

export type NoticeChatDialogProps = {
  notice: Notice;
  onClose: () => void;
};

/**
 * Нативный `<dialog>` через `showModal()`: браузер сам делает фон inert, держит фокус
 * внутри, закрывает по Esc и возвращает фокус на кнопку после `close()`.
 */
export const NoticeChatDialog = (props: NoticeChatDialogProps) => {
  const { notice, onClose } = props;

  const [store] = useState(() => createNoticeChatStore(notice.id));
  const messages = useStore(store, (state) => state.messages);
  const status = useStore(store, (state) => state.status);
  const error = useStore(store, (state) => state.error);
  const { ask, stop } = store.getState().actions;

  const [draft, setDraft] = useState("");
  const titleId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottom = useRef(true);
  const isClosing = useRef(false);

  const isStreaming = status === "streaming";

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    dialog.showModal();
    // `autoFocus` React не пишет в DOM, и `showModal()` ставит фокус на первую кнопку
    inputRef.current?.focus();
    // Модалка не блокирует колесо на window — без остановки Lenis страница едет под фоном
    window.__GLOBAL_SCROLL__?.stop();

    if (!prefersReducedMotion()) {
      gsap.fromTo(
        dialog,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
      );
    }

    return () => {
      gsap.killTweensOf(dialog);
      store.getState().actions.stop();
      window.__GLOBAL_SCROLL__?.start();

      if (dialog.open) {
        dialog.close();
      }
    };
  }, [store]);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;

    if (!dialog || isClosing.current) {
      return;
    }

    isClosing.current = true;

    if (prefersReducedMotion()) {
      onClose();
      return;
    }

    gsap.to(dialog, {
      opacity: 0,
      y: 24,
      duration: 0.25,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: onClose,
    });
  }, [onClose]);

  // Новый текст ответа — держим низ в кадре, если пользователь не отмотал вверх
  useLayoutEffect(() => {
    const container = scrollRef.current;

    if (container && isAtBottom.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, error]);

  const handleScroll = () => {
    const container = scrollRef.current;

    if (container) {
      isAtBottom.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <=
        BOTTOM_THRESHOLD;
    }
  };

  const send = (question: string) => {
    isAtBottom.current = true;
    ask(question);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!draft.trim() || isStreaming) {
      return;
    }

    send(draft);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      handleSubmit(event);
    }
  };

  // Esc: отменяем мгновенное закрытие, чтобы отыграть анимацию
  const handleCancel = (event: SyntheticEvent) => {
    event.preventDefault();
    requestClose();
  };

  // Клик мимо панели попадает в сам `<dialog>` — у него нет паддинга, панель занимает всё
  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={s.root}
      aria-labelledby={titleId}
      style={{ "--accent": `var(--c-kind-${notice.kind})` } as CSSProperties}
      onCancel={handleCancel}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className={s.panel}>
        <header className={s.header}>
          <div className={s.heading}>
            <h2 id={titleId} className={s.title}>
              Ask about this event
            </h2>
            <p className={s.subtitle}>{notice.title}</p>
          </div>
          <button
            type="button"
            className={s.close}
            onClick={requestClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div
          ref={scrollRef}
          className={s.scroll}
          onScroll={handleScroll}
          role="log"
          aria-busy={isStreaming}
          data-lenis-prevent
        >
          {!messages.length && (
            <p className={s.hint}>
              Answers are generated by AI from GCN Circulars and mission guides
              and may contain mistakes.
            </p>
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <p key={message.id} className={clsx(s.message, s.question)}>
                {message.content}
              </p>
            ) : (
              <div key={message.id} className={clsx(s.message, s.answer)}>
                {message.content ? (
                  <ChatMarkdown>{message.content}</ChatMarkdown>
                ) : (
                  <p className={s.pending}>Thinking…</p>
                )}

                {Boolean(message.sources?.length) && (
                  <ul className={s.sources} aria-label="Sources">
                    {message.sources?.map((source) => (
                      <li key={source.url}>
                        <a
                          className={s.source}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={source.title}
                        >
                          <span className={s.sourceLabel}>{source.label}</span>
                          <span className={s.sourceTitle}>{source.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          )}

          {error && (
            <div className={s.error} role="alert">
              <p>{error.message}</p>
              <button
                type="button"
                className={s.retry}
                onClick={() => send(error.question)}
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <div className={s.suggestions}>
          {SUGGESTIONS.map(({ label, question }) => (
            <button
              key={label}
              type="button"
              className={s.suggestion}
              disabled={isStreaming}
              onClick={() => send(question)}
            >
              {label}
            </button>
          ))}
        </div>

        <form className={s.form} onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className={s.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_QUESTION_LENGTH}
            rows={2}
            placeholder="Ask a question in English…"
            aria-label="Your question"
          />
          {isStreaming ? (
            <button type="button" className={s.submit} onClick={stop}>
              Stop
            </button>
          ) : (
            <button type="submit" className={s.submit} disabled={!draft.trim()}>
              Send
            </button>
          )}
        </form>
      </div>
    </dialog>
  );
};

NoticeChatDialog.displayName = "NoticeChatDialog";
