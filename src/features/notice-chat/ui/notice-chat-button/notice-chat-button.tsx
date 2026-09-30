"use client";

import { useState } from "react";
import clsx from "clsx";
import dynamic from "next/dynamic";

import type { Notice } from "@entities/notice";

import s from "./notice-chat-button.module.scss";

/** Модалка вместе с `react-markdown` грузится по первому клику, а не с лентой. */
const NoticeChatDialog = dynamic(
  () => import("../notice-chat-dialog").then((mod) => mod.NoticeChatDialog),
  { ssr: false },
);

export type NoticeChatButtonProps = {
  notice: Notice;
  className?: string;
};

export const NoticeChatButton = (props: NoticeChatButtonProps) => {
  const { notice, className } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={clsx(s.root, className)}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        Ask AI
      </button>

      {isOpen && (
        <NoticeChatDialog notice={notice} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
};

NoticeChatButton.displayName = "NoticeChatButton";
