/**
 * Моковый продюсер для разработки: гонит фикстуры через боевые парсеры и пишет их
 * в notices так же, как это делает консьюмер. Нужен потому, что GCN молчит часами —
 * без него не отладить ни ленту, ни анимации вставки.
 *
 *   pnpm --filter ingestor seed          # одна пачка
 *   pnpm --filter ingestor seed --loop   # по событию раз в 2 секунды
 */
import { insertNotices } from "../db/notices.js";
import { pool } from "../db/pool.js";
import { logger } from "../logger.js";
import { parseNotice } from "../parsers/index.js";

const gwAlert = (supereventId: string) =>
  JSON.stringify({
    alert_type: "PRELIMINARY",
    time_created: new Date().toISOString(),
    superevent_id: supereventId,
    event: {
      time: new Date().toISOString(),
      far: 3.2e-10,
      significant: true,
      instruments: ["H1", "L1", "V1"],
      group: "CBC",
      pipeline: "gstlal",
      classification: { BBH: 0.87, BNS: 0.02, NSBH: 0.05, Terrestrial: 0.06 },
      skymap: "<вырезается парсером>",
    },
  });

const circular = (circularId: number) =>
  JSON.stringify({
    circularId,
    subject: `GRB 260825A: Swift detection of a burst`,
    body: "The Swift Burst Alert Telescope triggered on GRB 260825A.\n\nRefined analysis follows.",
    createdOn: Date.now(),
    submitter: "dev seed",
  });

const classicText = (trigger: number) =>
  [
    "TITLE:            GCN/FERMI NOTICE",
    "NOTICE_DATE:      Tue 25 Aug 26 19:40:12 UT",
    "NOTICE_TYPE:      Fermi-GBM Final Position",
    `TRIGGER_NUM:      ${trigger}`,
    "GRB_RA:           293.7500d {+19h 35m 00s} (J2000)",
    "GRB_DEC:          -12.3400d {-12d 20' 24\"} (J2000)",
    "GRB_ERROR:        3.20 [deg radius, statistical only]",
  ].join("\n");

const FIXTURES: Array<[topic: string, build: (seed: number) => string]> = [
  ["igwn.gwalert", (seed) => gwAlert(`S26082${seed}a`)],
  ["gcn.circulars", (seed) => circular(40000 + seed)],
  ["gcn.classic.text.FERMI_GBM_FIN_POS", (seed) => classicText(700000 + seed)],
];

const produce = async (seed: number, offsetBase: number) => {
  const fixture = FIXTURES[seed % FIXTURES.length];

  if (!fixture) {
    return;
  }

  const [topic, build] = fixture;
  const raw = build(seed);
  const inserted = await insertNotices([
    {
      ...parseNotice(raw, topic),
      topic,
      partition: 0,
      // отрицательные offset'ы: не пересекаются с настоящими сообщениями Kafka
      offset: String(-1 - offsetBase - seed),
    },
  ]);

  logger.info("Seed", { topic, inserted: inserted.length });
};

const run = async () => {
  const loop = process.argv.includes("--loop");
  let seed = 0;

  if (!loop) {
    // фиксированные offset'ы: повторный запуск обязан упереться в дедуп и ничего не добавить
    for (; seed < FIXTURES.length; seed += 1) {
      await produce(seed, 0);
    }

    await pool.end();
    return;
  }

  // в live-режиме база от времени старта, иначе перезапуск мока не даст ни одного события
  const offsetBase = Date.now();

  setInterval(() => {
    produce(seed, offsetBase).catch((error) =>
      logger.error("Seed упал", { error: String(error) }),
    );
    seed += 1;
  }, 2000);
};

run().catch((error) => {
  logger.error("Seed не смог отработать", { error: String(error) });
  process.exit(1);
});
