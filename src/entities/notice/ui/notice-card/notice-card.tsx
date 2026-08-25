"use client";

import { useState } from "react";
import clsx from "clsx";

import { mod } from "@shared/utils";

import { formatNoticeCoords, formatNoticeTime } from "../../lib/format";
import { NOTICE_KIND_BADGES, NOTICE_KIND_LABELS } from "../../model/kind";
import type { Notice } from "../../model/types";

import s from "./notice-card.module.scss";

/** Длиннее — сворачиваем: циркуляры бывают на несколько экранов и ломают ритм ленты. */
const COLLAPSE_AFTER = 320;

export type NoticeCardProps = {
  notice: Notice;
  className?: string;
};

export const NoticeCard = (props: NoticeCardProps) => {
  const { notice, className } = props;
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = notice.summary?.trim() || null;
  const isCollapsible = Boolean(summary && summary.length > COLLAPSE_AFTER);
  const coords = formatNoticeCoords(notice.coords);

  return (
    <article
      className={clsx(s.root, mod(s, { kind: notice.kind }), className)}
      data-notice-id={notice.id}
    >
      <header className={s.header}>
        <span className={s.badge}>{NOTICE_KIND_BADGES[notice.kind]}</span>
        <span className={s.kindLabel}>{NOTICE_KIND_LABELS[notice.kind]}</span>
        <time className={s.time} dateTime={notice.receivedAt}>
          {formatNoticeTime(notice.receivedAt)}
        </time>
      </header>

      <h3 className={s.title}>{notice.title}</h3>

      {summary && (
        <p
          className={clsx(s.summary, isCollapsible && !isExpanded && s.clamped)}
        >
          {summary}
        </p>
      )}

      {isCollapsible && (
        <button
          type="button"
          className={s.toggle}
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded ? "Свернуть" : "Читать целиком"}
        </button>
      )}

      <footer className={s.footer}>
        {notice.externalId && (
          <span className={s.meta}>{notice.externalId}</span>
        )}
        {coords && <span className={s.meta}>{coords}</span>}
        <span className={clsx(s.meta, s.topic)}>{notice.topic}</span>
      </footer>
    </article>
  );
};

NoticeCard.displayName = "NoticeCard";
