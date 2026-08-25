-- Хроника оповещений GCN.
-- Дедупликация: Kafka даёт at-least-once, при рестарте и ребалансировке дубли неизбежны,
-- поэтому уникальность по координатам сообщения в Kafka.
create table if not exists notices (
  id              bigserial primary key,
  topic           text not null,
  kafka_partition int not null,
  kafka_offset    bigint not null,
  external_id     text,
  kind            text not null default 'unknown',
  title           text not null,
  summary         text,
  ra              double precision,
  dec             double precision,
  error_radius    double precision,
  event_at        timestamptz,
  received_at     timestamptz not null default now(),
  payload         jsonb not null,
  unique (topic, kafka_partition, kafka_offset)
);

-- Лента листается курсором по (received_at, id) — offset поедет на первом же новом событии.
create index if not exists notices_feed_idx on notices (received_at desc, id desc);
create index if not exists notices_kind_idx on notices (kind);

-- Служебное key-value: liveness ingestor'а (heartbeat в БД не пишем — только отметку времени).
create table if not exists service_state (
  key   text primary key,
  value jsonb not null
);
