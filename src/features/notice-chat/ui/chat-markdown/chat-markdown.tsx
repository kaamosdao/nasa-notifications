"use client";

import Markdown, { type Components } from "react-markdown";

import s from "./chat-markdown.module.scss";

/** Белый список: заголовки, таблицы, картинки и сырой HTML из ответа модели не рендерим. */
const ALLOWED_ELEMENTS = ["p", "ul", "ol", "li", "strong", "em", "a", "code"];

const COMPONENTS: Components = {
  a: ({ node: _node, ...rest }) => (
    <a {...rest} target="_blank" rel="noopener noreferrer" />
  ),
};

export type ChatMarkdownProps = {
  children: string;
};

export const ChatMarkdown = (props: ChatMarkdownProps) => {
  const { children } = props;

  return (
    <div className={s.root}>
      <Markdown
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        components={COMPONENTS}
      >
        {children}
      </Markdown>
    </div>
  );
};

ChatMarkdown.displayName = "ChatMarkdown";
