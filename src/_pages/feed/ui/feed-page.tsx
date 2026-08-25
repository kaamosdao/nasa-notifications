"use client";

import { usePageData } from "@app/model/data-store";
import { NoticeFeedProvider } from "@features/notice-feed";
import { NoticeFeed } from "@widgets/notice-feed";

import type { NoticesPage } from "@entities/notice";

import s from "./feed-page.module.scss";

export type FeedPageData = {
  noticesPage: NoticesPage | null;
};

export const FeedPage = () => {
  const { noticesPage } = usePageData<FeedPageData>();

  return (
    <main className={s.root}>
      <NoticeFeedProvider page={noticesPage}>
        <NoticeFeed className={s.feed} />
      </NoticeFeedProvider>
    </main>
  );
};

FeedPage.displayName = "FeedPage";
