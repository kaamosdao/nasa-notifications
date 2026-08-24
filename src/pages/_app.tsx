import "@/shared/styles/globals.scss";

import { GlobalDataProvider, PageDataProvider } from "@app/model/data-store";
import { useAppViewport } from "@app/model/viewport-store";
import { AppHooks } from "@widgets/app-hooks/app-hooks";
import { FpsWidget } from "@widgets/fps";
import { Gsap } from "@widgets/gsap";
import { Header } from "@widgets/header";
import { PerformanceDetect } from "@widgets/performance-detect";
import { Preloader } from "@widgets/preloader";
import { ResizeProvider } from "@widgets/resize";
import { Scroll } from "@widgets/scroll";
import { SeoLayout } from "@widgets/seo-layout";
import { TransitionLayout } from "@widgets/transition-layout";
import { Cursor } from "@widgets/сursor";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps, router }: AppProps) {
  useAppViewport();

  return (
    <>
      <FpsWidget />
      <PerformanceDetect />
      <Gsap />
      <SeoLayout pageSeoData={pageProps?.cms?.pageSeoData}>
        <ResizeProvider>
          <GlobalDataProvider data={{}}>
            <Header />
            <Cursor />
            <Preloader />
            <Scroll root wrapper>
              <TransitionLayout router={router}>
                <PageDataProvider data={pageProps?.cms ?? {}}>
                  <Component {...pageProps} />
                </PageDataProvider>
              </TransitionLayout>
            </Scroll>
          </GlobalDataProvider>
        </ResizeProvider>
        <AppHooks />
      </SeoLayout>
    </>
  );
}
