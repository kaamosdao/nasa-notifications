import "@/shared/styles/globals.scss";

import { GlobalDataProvider, PageDataProvider } from "@app/model/data-store";
import { useAppViewport } from "@app/model/viewport-store";
import { AppHooks } from "@widgets/app-hooks/app-hooks";
import { FpsWidget } from "@widgets/fps";
import { Gsap } from "@widgets/gsap";
import { Header } from "@widgets/header";
import { HeroIntro } from "@widgets/hero-intro";
import { HeroControlsPanel, HeroMetaballs } from "@widgets/hero-metaballs";
import { PerformanceDetect } from "@widgets/performance-detect";
import { ResizeProvider } from "@widgets/resize";
import { Scroll } from "@widgets/scroll";
import { SeoLayout } from "@widgets/seo-layout";
import { TransitionLayout } from "@widgets/transition-layout";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps, router }: AppProps) {
  useAppViewport();

  return (
    <>
      <FpsWidget />
      <HeroControlsPanel />
      <PerformanceDetect />
      <Gsap />
      <SeoLayout pageSeoData={pageProps?.cms?.pageSeoData}>
        <ResizeProvider>
          <GlobalDataProvider data={{}}>
            {/* Выше страницы в дереве: контекст WebGL переживает переход фаз и роутинг. */}
            <HeroMetaballs />
            <HeroIntro />
            <Header />
            {/*
              DOM-курсор из boilerplate убран: он рисовал название своего типа («default»)
              поверх hero, а роль курсора здесь играет шар в шейдере.
            */}
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
