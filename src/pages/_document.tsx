import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    // Интерфейс русскоязычный: без `lang` скринридер читает его английскими правилами.
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
