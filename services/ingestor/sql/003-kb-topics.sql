-- Префиксы Kafka-топиков, к notice которых относится справочная статья
-- (front matter `topics` в knowledge/*.md). `kind` для этого слишком груб:
-- у Fermi, Swift, SVOM и Einstein Probe он один — grb, а статьи про миссии разные.
-- У циркуляров массив пустой. Статей десятки, поэтому без индекса.
alter table kb_chunks add column if not exists topics text[] not null default '{}';
