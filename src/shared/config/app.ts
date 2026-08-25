export const siteURL = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
export const siteOrigin = siteURL.origin;

export const APP_INFO = {
  APP_DEFAULT_TITLE: "NASA · GCN — поток астрофизических оповещений",
  APP_TITLE_TEMPLATE: "%s",
  APP_DESCRIPTION:
    "Оповещения GCN в реальном времени: гравитационные волны, гамма-всплески, нейтрино и циркуляры — лента событий без перезагрузки страницы.",
  APP_KEYWORDS:
    "GCN, NASA, гравитационные волны, гамма-всплески, нейтрино, LIGO, Fermi, Swift, IceCube, астрофизика, оповещения",
  // Тот же цвет, что `--c-space`: панель браузера не должна спорить с фоном сцены.
  APP_DEFAULT_THEME: "#05060a",
  APP_SITE_URL_ORIGIN: siteOrigin || "",
  APP_BASE_URL: siteURL,
  APP_DOMAIN: siteURL.hostname,
  APP_DEFAULT_OG: "/og.png",
  /**
   * Разрешена ли индексация окружения. Тот же сигнал, что и в `src/pages/robots.txt.ts`
   * (`NEXT_PUBLIC_APP_ENV === "production"`) — единый источник правды «окружение открыто».
   * Индексируется только прод; тест/preview отдают `<meta name="robots" content="noindex,nofollow">`
   * и `Disallow: /` в robots.txt. Дефолт закрытый: лишняя индексация теста — тихая и вредная.
   */
  APP_ALLOW_INDEXING: process.env.NEXT_PUBLIC_APP_ENV === "production",
};

export type AppInfoType = typeof APP_INFO;
