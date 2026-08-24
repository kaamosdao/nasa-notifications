// Плоский CommonJS-конфиг: НЕ импортирует TS-модули из src/, чтобы next start в
// production-образе (где devDependencies, включая typescript, вырезаны `pnpm prune --prod`)
// мог загрузить конфиг без рантайм-транспиляции TS.
// Значения rewrites выводятся из PROJECT_SLUG напрямую — источник правды тот же, что в
// src/shared/config/api.ts (baseUrl) и src/shared/config/img-proxy.ts (imgProxyBaseUrl);
// при их изменении синхронизируй здесь.

const path = require("node:path");

const projectSlug = process.env.PROJECT_SLUG;
const baseUrl = `http://${projectSlug}_backend:1337/api`;
const imgProxyPublicPath = "/imgproxy";
const imgProxyBaseUrl = `http://${projectSlug}_imgproxy:8080`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  sassOptions: {
    includePaths: [
      path.join(__dirname, "src", "shared", "ui"),
      path.join(__dirname, "src", "shared", "styles"),
    ],
    prependData: `@use 'helpers' as *;`,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${baseUrl}/:path*`,
      },
      {
        source: `${imgProxyPublicPath}/:path*`,
        destination: `${imgProxyBaseUrl}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            prettier: false,
            svgo: true,
            ref: true,
            svgoConfig: {
              plugins: [
                "prefixIds",
                // { name: "convertStyleToAttrs" },
                { name: "removeAttrs", params: { attrs: ["fill"] } },
              ],
            },
          },
        },
      ],
    });

    return config;
  },
};

module.exports = nextConfig;
