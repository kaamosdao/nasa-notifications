import type { GetServerSidePropsContext } from "next";

import { getServerSidePropsData } from "@shared/api/strapi/getServerSidePropsData";
//
import { getHomePage } from "@/_pages/home/api";
import { HomePage } from "@/_pages/home/ui";

const Page = () => {
  return <HomePage />;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  // Проверяем, включен ли draft mode
  const isDraftMode = context.draftMode || false;

  // homePage и commonData уже типизированы оркестратором — каст не нужен.
  const { commonData, homePage } = await getServerSidePropsData(
    { homePage: getHomePage },
    { isDraftMode },
  );

  return {
    props: {
      isDraftMode,
      cms: {
        commonData,
        homePage,
        // Верхнее звено SEO fallback-цепочки для этой страницы. _app.tsx читает
        // cms.pageSeoData и передаёт в SeoLayout как pageSeoData (переопределяет commonData.seo).
        pageSeoData: homePage?.seo ?? null,
      },
    },
  };
}

export default Page;
