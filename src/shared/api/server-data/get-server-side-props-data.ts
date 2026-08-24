/** Функция запроса данных страницы. */
type RequestFn<R = unknown> = () => Promise<R>;

type ResultOf<T extends Record<string, RequestFn>> = {
  [K in keyof T]: Awaited<ReturnType<T[K]>> | null;
};

/**
 * Оркестратор серверных данных для getServerSideProps.
 *
 * Особенности:
 *  - Тип результата выводится из карты запросов — на выходе `data.notices` уже типизирован,
 *    каст в роуте не нужен.
 *  - Ошибки изолированы по ключу: упавший запрос даёт `null` только своему ключу, остальные
 *    приходят как обычно. Один недоступный источник не роняет страницу целиком.
 *  - Запросы стартуют параллельно.
 */
export async function getServerSidePropsData<
  T extends Record<string, RequestFn>,
>(requests: T): Promise<ResultOf<T>> {
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

  const entries = await Promise.all(
    Object.entries(requests).map(
      async ([key, fn]) => [key, await settle(key, fn())] as const,
    ),
  );

  return Object.fromEntries(entries) as ResultOf<T>;
}
