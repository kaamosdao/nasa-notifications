import type { GetServerSideProps } from "next";

import { DEFAULT_LIMIT, getNotices } from "@shared/api/db";
import { getServerSidePropsData } from "@shared/api/server-data";
import { FeedPage } from "@/_pages/feed";

const Page = () => {
  return <FeedPage />;
};

/**
 * Прямой SELECT, а не HTTP-запрос к собственному `/api/notices`: лишний сетевой хоп на том же
 * процессе. Ошибка изолируется оркестратором — страница отрисуется с пустой лентой, а не упадёт.
 */
export const getServerSideProps: GetServerSideProps = async () => {
  const cms = await getServerSidePropsData({
    noticesPage: () => getNotices({ limit: DEFAULT_LIMIT }),
  });

  return { props: { cms } };
};

export default Page;
