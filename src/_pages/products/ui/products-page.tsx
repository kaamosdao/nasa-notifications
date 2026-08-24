"use client";

import { usePageData } from "@app/model/data-store";

import { Link } from "@shared/ui/link";
import { MediaImage } from "@shared/ui/media-image";
import type { ProductsListResult } from "@/_pages/products/api";

import styles from "./products-page.module.scss";

/**
 * Ссылка на страницу листинга.
 * Первая страница — всегда `/products` без параметра: `?page=1` эквивалентен базовому URL,
 * и отдельная ссылка на него создавала бы дубль (canonical такой параметр тоже отбрасывает).
 */
const pageHref = (page: number): string =>
  page <= 1 ? "/products" : `/products?page=${page}`;

export const ProductsPage = () => {
  const { products } = usePageData<{ products: ProductsListResult | null }>();

  const items = products?.items ?? [];
  const page = products?.page ?? 1;
  const hasNext = products?.hasNext ?? false;

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>Products</h1>

      {items.length === 0 ? (
        <p className={styles.empty}>Пока нет опубликованных товаров.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.documentId || item.slug} className={styles.item}>
              <Link href={`/products/${item.slug}`} className={styles.card}>
                {item.image && (
                  <MediaImage source={item.image} className={styles.image} />
                )}
                <span className={styles.cardTitle}>{item.title}</span>
                <span className={styles.price}>{item.price}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/*
        Пагинация — настоящие <a href> (Link → Button → next/link), а не кнопки с router.push:
        иначе бот не видит ссылок и глубокие страницы не обходятся вовсе.
      */}
      {(page > 1 || hasNext) && (
        <nav className={styles.pagination} aria-label="Пагинация">
          {/* rel="prev"/"next" не ставим: Google не использует их для индексации с 2019 г.,
              а обход обеспечивают обычные ссылки. */}
          {page > 1 && <Link href={pageHref(page - 1)}>Назад</Link>}
          <span>Страница {page}</span>
          {hasNext && <Link href={pageHref(page + 1)}>Вперёд</Link>}
        </nav>
      )}
    </main>
  );
};

ProductsPage.displayName = "ProductsPage";
