// Плоский CommonJS-конфиг: НЕ импортирует TS-модули из src/, чтобы next start в
// production-образе (где devDependencies, включая typescript, вырезаны `pnpm prune --prod`)
// мог загрузить конфиг без рантайм-транспиляции TS.

const path = require("node:path");

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
