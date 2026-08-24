import type { GetServerSidePropsContext } from "next";

import { getServerSidePropsData } from "@shared/api/strapi/getServerSidePropsData";
import { getProducts, parsePageParam } from "@/_pages/products/api";
import { ProductsPage } from "@/_pages/products/ui";

const Page = () => {
  return <ProductsPage />;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const isDraftMode = context.draftMode || false;

  // `?page` разрешён в canonical для этого маршрута (см. og-tags/canonical.ts), поэтому роут
  // ОБЯЗАН отдавать по нему разный контент — иначе получаем два индексируемых URL с одинаковыми
  // товарами, то есть ровно тот дубль, от которого canonical и защищает.
  const page = parsePageParam(context.query.page);

  const { commonData, products } = await getServerSidePropsData(
    { products: (opts) => getProducts({ ...opts, page }) },
    { isDraftMode },
  );

  return {
    props: {
      isDraftMode,
      cms: {
        commonData,
        products,
      },
    },
  };
}

export default Page;
