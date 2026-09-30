-- JSON-нотисы (parseGenericJson) писали в external_id название инструмента ('WXT',
-- 'BAT-GUANO'): unified schema GCN кладёт `id` массивом, а парсер брал только строки.
-- По external_id чат ищет циркуляры о событии — пересчитываем тем же правилом, что
-- теперь в парсере: ref_ID, затем первый элемент id, затем прочие ключи.
update notices
   set external_id = coalesce(
         payload->>'ref_ID',
         case jsonb_typeof(payload->'id')
           when 'array' then payload->'id'->>0
           else payload->>'id'
         end,
         payload->>'trigger_id',
         payload->>'burst_id',
         payload->>'event_id',
         payload->>'alert_id'
       )
 where topic not like 'gcn.classic.text.%'
   and topic not in ('igwn.gwalert', 'gcn.circulars')
   -- у fallback в payload лежит сырой текст, идентификатора там нет
   and kind <> 'unknown';
