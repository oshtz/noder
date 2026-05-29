export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' &&
  (Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) ||
    import.meta.env.MODE === 'test');
