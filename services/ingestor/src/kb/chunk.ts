/**
 * ~1500 символов ≈ 350–700 токенов: кусок про одну мысль циркуляра (наблюдение, результат),
 * и с запасом влезает в контекст модели эмбеддингов вместе с заголовком.
 */
const MAX_CHARS = 1500;

/** Режет абзац длиннее лимита по последнему переносу или пробелу. */
const splitLong = (paragraph: string): string[] => {
  const parts: string[] = [];
  let rest = paragraph;

  while (rest.length > MAX_CHARS) {
    const soft = Math.max(
      rest.lastIndexOf("\n", MAX_CHARS),
      rest.lastIndexOf(" ", MAX_CHARS),
    );
    // нет удобного разрыва во второй половине (длинная строка таблицы) — режем жёстко
    const at = soft > MAX_CHARS / 2 ? soft : MAX_CHARS;

    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }

  return rest ? [...parts, rest] : parts;
};

/**
 * Текст → куски по границам абзацев. Абзацы склеиваются, пока влезают в лимит,
 * поэтому короткий циркуляр — это один кусок. Перекрытие не нужно: абзац циркуляра
 * самодостаточен, а заголовок документа добавляется к каждому куску при эмбеддинге.
 */
export const chunkText = (text: string): string[] => {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitLong);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > MAX_CHARS) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  return current ? [...chunks, current] : chunks;
};
