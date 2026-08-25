"use client";

import {
  createContext,
  type PropsWithChildren,
  useContext,
  useRef,
} from "react";
import { useStore } from "zustand";

import type { NoticesPage } from "@entities/notice";

import {
  createNoticeFeedStore,
  type NoticeFeedState,
  type NoticeFeedStore,
} from "./feed-store";

const NoticeFeedContext = createContext<NoticeFeedStore | null>(null);

export type NoticeFeedProviderProps = PropsWithChildren<{
  /** Первая страница из getServerSideProps: с ней store и создаётся. */
  page: NoticesPage | null;
}>;

export const NoticeFeedProvider = ({
  page,
  children,
}: NoticeFeedProviderProps) => {
  const storeRef = useRef<NoticeFeedStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createNoticeFeedStore(page);
  }

  return (
    <NoticeFeedContext.Provider value={storeRef.current}>
      {children}
    </NoticeFeedContext.Provider>
  );
};

NoticeFeedProvider.displayName = "NoticeFeedProvider";

/** Сам store — для чтения состояния вне рендера (коллбэки, обсерверы). */
export const useNoticeFeedApi = (): NoticeFeedStore => {
  const store = useContext(NoticeFeedContext);

  if (!store) {
    throw new Error(
      "useNoticeFeed* должен вызываться внутри NoticeFeedProvider",
    );
  }

  return store;
};

export const useNoticeFeed = <T,>(selector: (state: NoticeFeedState) => T): T =>
  useStore(useNoticeFeedApi(), selector);

export const useNoticeFeedActions = (): NoticeFeedState["actions"] =>
  useNoticeFeed((state) => state.actions);
