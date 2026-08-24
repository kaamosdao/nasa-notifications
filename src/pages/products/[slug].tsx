import type { GetServerSidePropsContext } from "next";

import { getServerSidePropsData } from "@shared/api/strapi/getServerSidePropsData";
import { getProduct } from "@/_pages/products/api";
import { ProductPage } from "@/_pages/products/ui";

const Page = () => {
  return <ProductPage />;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const isDraftMode = context.draftMode || false;
  const slugParam = context.params?.slug;
  const slug = typeof slugParam === "string" ? slugParam : "";

  const { commonData, product } = await getServerSidePropsData(
    {
      product: ({ status }) => getProduct({ slug, status }),
    },
    { isDraftMode },
  );

  if (!product) {
    return { notFound: true };
  }

  return {
    props: {
      isDraftMode,
      cms: {
        commonData,
        product,
      },
    },
  };
}

export default Page;
