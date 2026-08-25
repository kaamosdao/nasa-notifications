import type { NoticesPage } from "@entities/notice";

export type FetchNoticesParams = {
  /** Курсор `nextCursor` предыдущей страницы; без него — самые свежие. */
  before?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

export const fetchNotices = async ({
  before,
  limit,
  signal,
}: FetchNoticesParams = {}): Promise<NoticesPage> => {
  const params = new URLSearchParams();

  if (before) {
    params.set("before", before);
  }

  if (limit) {
    params.set("limit", String(limit));
  }

  const query = params.toString();
  const response = await fetch(`/api/notices${query ? `?${query}` : ""}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`/api/notices ответил ${response.status}`);
  }

  return (await response.json()) as NoticesPage;
};
