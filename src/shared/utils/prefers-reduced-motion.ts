/**
 * Читается на каждом вызове, а не кэшируется: настройку системы меняют на лету, и следующий
 * переход должен уже её учитывать. Вызывать только в эффектах — на сервере `window` нет.
 */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
