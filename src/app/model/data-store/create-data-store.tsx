import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * Фабрика типизированного data-store на zustand + React Context.
 *
 * Возвращает пару `[Provider, useData]`. Каждый вызов создаёт ИЗОЛИРОВАННЫЙ store —
 * так глобальные (common) и страничные данные живут в разных сторах и не смешиваются.
 * Store пересинхронизируется при смене `data` (навигация), но экземпляр сохраняется.
 */
export function createDataStore<T extends Record<string, unknown>>(
  name: string,
) {
  type State = T & { setData: (patch: Partial<T>) => void };

  const StoreContext = createContext<StoreApi<State> | null>(null);

  const Provider = ({ data, children }: PropsWithChildren<{ data: T }>) => {
    const storeRef = useRef<StoreApi<State> | null>(null);

    if (!storeRef.current) {
      storeRef.current = createStore<State>((set) => ({
        ...data,
        setData: (patch) => set((state) => ({ ...state, ...patch })),
      }));
    }

    // При переходе на другую страницу data меняется — обновляем store, не пересоздавая его.
    useEffect(() => {
      storeRef.current?.getState().setData(data);
    }, [data]);

    return (
      <StoreContext.Provider value={storeRef.current}>
        {children}
      </StoreContext.Provider>
    );
  };
  Provider.displayName = `${name}Provider`;

  /**
   * Возвращает состояние store, типизированное как `TState`.
   * Для глобального стора тип известен; для страничного передавай форму данных страницы:
   *   const { homePage } = usePageData<{ homePage: HomePageProps }>();
   */
  const useData = <TState extends Record<string, unknown> = T>(): TState => {
    const store = useContext(StoreContext);

    if (!store) {
      throw new Error(`use${name} должен вызываться внутри <${name}Provider>`);
    }

    return useStore(store, (state) => state as unknown as TState);
  };

  return [Provider, useData] as const;
}
