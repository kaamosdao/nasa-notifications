// Эталонный переиспользуемый хук проекта (для AI-контекста).
// Живой аналог: src/shared/hooks/use-media.ts
//
// Соглашения:
//  1. Файл именуется kebab-case с префиксом use-: use-<name>.ts (лежит в src/shared/hooks/
//     для общих хуков, либо в сегменте hooks/ конкретного слайса).
//  2. Экспорт — named, стрелочная функция `export const useX = (...) => {...}`.
//  3. Побочные эффекты — в useEffect с корректной очисткой (return () => ...).
//  4. Браузерные API проверяем на поддержку через isApiSupported перед использованием
//     (SSR-безопасность: код исполняется и на сервере в Pages Router).
//  5. Типы аргументов/возврата — явные; дженерики, когда хук обобщённый.
//
// Публичного index.ts у одиночного хука в shared/hooks обычно нет — импортируют напрямую:
//   import { useMediaQuery } from "@shared/hooks/use-media-query";

import { useEffect, useState } from "react";

import { isApiSupported } from "@shared/utils/is-api-supported";

/**
 * Подписывается на media-query и возвращает его текущее состояние.
 * @param query — строка media-query, напр. "(max-width: 768px)"
 * @param initialValue — значение до гидрации (важно для совпадения SSR/CSR разметки)
 */
export const useMediaQuery = (query: string, initialValue = false): boolean => {
  const [matches, setMatches] = useState<boolean>(initialValue);

  useEffect(() => {
    if (!isApiSupported("matchMedia")) {
      console.warn("matchMedia is not supported by your current browser");
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const changeHandler = () => setMatches(mediaQueryList.matches);

    // синхронизируем сразу — matchMedia мог измениться между рендером и эффектом
    changeHandler();
    mediaQueryList.addEventListener("change", changeHandler);

    return () => {
      mediaQueryList.removeEventListener("change", changeHandler);
    };
  }, [query]);

  return matches;
};
