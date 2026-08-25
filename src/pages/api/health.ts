import type { NextApiRequest, NextApiResponse } from "next";

import { getIngestorHealth, type IngestorHealth } from "@shared/api/db";

type ErrorBody = { error: string };

/** Статус ingestor: когда последний heartbeat и насколько он отстал. */
export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<IngestorHealth | ErrorBody>,
) {
  try {
    const health = await getIngestorHealth();

    res.setHeader("Cache-Control", "no-store");
    // 200 и при `stale`: сам роут жив, а протухший heartbeat — это состояние в теле ответа.
    res.status(200).json(health);
  } catch (error) {
    console.error("[api/health]", error);
    res.status(503).json({ error: "База недоступна" });
  }
}
