import { z } from "zod";

/**
 * Дефолтный набор топиков: приоритетные JSON-схемы + классические текстовые нотисы.
 * Перекрывается переменной GCN_TOPICS (csv).
 */
const DEFAULT_TOPICS = [
  "igwn.gwalert",
  "gcn.circulars",
  "gcn.notices.einstein_probe.wxt.alert",
  "gcn.notices.icecube.lvk_nu_track_search",
  "gcn.notices.svom.voevent.grm",
  "gcn.notices.swift.bat.guano",
  "gcn.classic.text.FERMI_GBM_FLT_POS",
  "gcn.classic.text.FERMI_GBM_FIN_POS",
  "gcn.classic.text.SWIFT_BAT_GRB_POS_ACK",
  "gcn.classic.text.ICECUBE_ASTROTRACK_GOLD",
  "gcn.classic.text.ICECUBE_ASTROTRACK_BRONZE",
  "gcn.heartbeat",
];

const csv = z.string().transform((value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

const schema = z.object({
  GCN_CLIENT_ID: z.string().min(1),
  GCN_CLIENT_SECRET: z.string().min(1),
  GCN_TOPICS: csv.optional(),
  GCN_BACKFILL_DAYS: z.coerce.number().min(0).max(30).default(7),
  GCN_CONSUMER_GROUP: z.string().min(1).default("nasa-notifications"),
  DATABASE_URL: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Некорректное окружение ingestor:\n${issues}`);
}

const env = parsed.data;

export const config = {
  databaseUrl: env.DATABASE_URL,
  gcn: {
    clientId: env.GCN_CLIENT_ID,
    clientSecret: env.GCN_CLIENT_SECRET,
    groupId: env.GCN_CONSUMER_GROUP,
    topics: env.GCN_TOPICS?.length ? env.GCN_TOPICS : DEFAULT_TOPICS,
    backfillDays: env.GCN_BACKFILL_DAYS,
  },
  /** Топик-пульс: в БД не пишем, только обновляем отметку liveness. */
  heartbeatTopic: "gcn.heartbeat",
  /** Ключ в service_state, под которым живёт статус воркера. */
  stateKey: "ingestor",
} as const;
