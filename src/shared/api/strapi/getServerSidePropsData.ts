import { type CommonData, getCommonData } from "./getCommonData";

type Status = "draft" | "published";

/** Функция запроса данных страницы: принимает статус (draft/published), возвращает данные. */
type RequestFn<R = unknown> = (opts: { status: Status }) => Promise<R>;

type ResultOf<T extends Record<string, RequestFn>> = {
  [K in keyof T]: Awaited<ReturnType<T[K]>> | null;
};

/**
 * Оркестратор серверных данных для getServerSideProps.
 *
 * Особенности:
 *  - Тип результата выводится из карты запросов — на выходе `data.homePage` уже типизирован,
 *    каст в роуте не нужен.
 *  - Ошибки изолированы по ключу: упавший запрос даёт `null` только своему ключу, остальные
 *    (в т.ч. глобальные `commonData`) приходят как обычно. Меню/футер не исчезают из-за
 *    упавшего страничного запроса.
 *  - `commonData` (глобальные данные сайта) домешивается всегда и кэшируется (см. getCommonData).
 */
export async function getServerSidePropsData<
  T extends Record<string, RequestFn>,
>(
  requests: T,
  options?: { isDraftMode?: boolean },
): Promise<{ commonData: CommonData | null } & ResultOf<T>> {
  const isDraft = options?.isDraftMode ?? false;
  const status: Status = isDraft ? "draft" : "published";

  const settle = async <R>(
    label: string,
    promise: Promise<R>,
  ): Promise<R | null> => {
    try {
      return await promise;
    } catch (error) {
      console.error(`[getServerSidePropsData] запрос "${label}" упал:`, error);
      return null;
    }
  };

  // Глобальные и страничные запросы стартуют параллельно.
  const commonPromise = settle(
    "commonData",
    getCommonData({ status, bypassCache: isDraft }),
  );

  const pageEntries = await Promise.all(
    Object.entries(requests).map(
      async ([key, fn]) => [key, await settle(key, fn({ status }))] as const,
    ),
  );

  return {
    commonData: await commonPromise,
    ...Object.fromEntries(pageEntries),
  } as { commonData: CommonData | null } & ResultOf<T>;
}
