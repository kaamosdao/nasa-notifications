"use client";

import { usePageData } from "@app/model/data-store";

import { Link } from "@shared/ui/link";
import { MediaImage } from "@shared/ui/media-image";
import type { Product } from "@/_pages/products/model";

import styles from "./product-page.module.scss";

export const ProductPage = () => {
  const { product } = usePageData<{ product: Product | null }>();

  if (!product) {
    return (
      <main className={styles.root}>
        <p>Товар не найден.</p>
        <Link href="/products">← К списку</Link>
      </main>
    );
  }

  return (
    <main className={styles.root}>
      <Link href="/products" className={styles.back}>
        ← Products
      </Link>

      {product.image && (
        <MediaImage source={product.image} className={styles.image} />
      )}

      <h1 className={styles.title}>{product.title}</h1>
      <p className={styles.price}>{product.price}</p>

      {product.description && (
        <div className={styles.description}>{product.description}</div>
      )}
    </main>
  );
};

ProductPage.displayName = "ProductPage";
