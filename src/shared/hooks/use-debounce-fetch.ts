import { useEffect, useRef, useState } from "react";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
};

export type UseDebouncedFetchResult<T> = State<T> & {
  debouncedQuery: string;
};

export function useDebouncedFetch<T>(
  query: string,
  fetcher: (q: string, signal: AbortSignal) => Promise<T>,
  delay = 300,
): UseDebouncedFetchResult<T> {
  const [debounced, setDebounced] = useState(query);
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const controllerRef = useRef<AbortController | null>(null);

  // debounce
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), delay);
    return () => clearTimeout(id);
  }, [query, delay]);

  useEffect(() => {
    if (!debounced || query === debounced) return;
    controllerRef.current?.abort();
  }, [query, debounced]);

  // fetch с отменой
  useEffect(() => {
    if (!debounced) {
      setState((s) => ({ ...s, data: null, loading: false }));
      return;
    }

    // отменяем предыдущий запрос
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    fetcher(debounced, controller.signal)
      .then((data) => {
        setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        setState({ data: null, loading: false, error: err });
      });

    return () => controller.abort();
  }, [debounced, fetcher]);

  return { ...state, debouncedQuery: debounced };
}
