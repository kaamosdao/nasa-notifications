export type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

export type SitemapCollection = {
  /** Strapi collection uid (plural API id), e.g. "products" */
  uid: string;
  toPath: (slug: string) => string;
};
