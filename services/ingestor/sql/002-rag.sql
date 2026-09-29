-- База знаний для AI-чата (RAG): справочные статьи и GCN Circulars, порезанные на куски,
-- у каждого куска — вектор смысла от модели эмбеддингов. План — docs/16-ai-chat.md.

-- Образ Postgres сменился с alpine (musl) на pgvector/pgvector (debian, glibc): порядок
-- сортировки текста у них разный, и btree-индексы по text-колонкам, построенные старым
-- образом, становятся неконсистентными. Перестраиваем их; на свежей базе — no-op по смыслу.
reindex table notices;
reindex table service_state;
reindex table schema_migrations;

create extension if not exists vector;

-- Один документ (статья или циркуляр) = несколько строк-кусков (chunk_index 0..n).
-- Уникальность по (source, source_id, chunk_index) делает переиндексацию идемпотентной:
-- повторный прогон обновляет строки, а не плодит дубли.
create table if not exists kb_chunks (
  id           bigserial primary key,
  -- 'knowledge' — курируемые статьи из knowledge/*.md, 'circular' — GCN Circulars
  source       text not null,
  -- имя файла статьи или номер циркуляра
  source_id    text not null,
  chunk_index  int not null,
  -- тот же NoticeKind, что в notices: по нему подбирается справка к notice
  kind         text,
  -- 'GRB 250929A', 'S250929ab', 'EP250929a' — точный поиск циркуляров по событию
  event_name   text,
  title        text not null,
  url          text,
  content      text not null,
  published_at timestamptz,
  -- размерность задаёт модель эмбеддингов (nomic-embed-text = 768);
  -- смена модели на другую размерность = пересоздание колонки и полная переиндексация
  embedding    vector(768) not null,
  unique (source, source_id, chunk_index)
);

-- Приближённый поиск ближайших соседей по косинусному расстоянию (оператор <=>).
-- Без индекса запрос сравнивает вопрос с каждой строкой таблицы.
create index if not exists kb_chunks_embedding_idx
  on kb_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists kb_chunks_event_name_idx on kb_chunks (event_name);
