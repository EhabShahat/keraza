export default function ToastStyles() {
  return (
    <style jsx global>{`
      .toast-container { position: fixed; top: 1rem; right: 1rem; display: grid; gap: .5rem; z-index: 1000; }
      .toast { position: relative; min-width: 220px; max-width: 360px; padding: .625rem .875rem; border-radius: 10px; border: 1px solid var(--border); background: var(--card); box-shadow: 0 10px 20px rgba(0,0,0,.06); }
      .toast .toast-title { font-weight: 700; margin-bottom: .125rem; }
      .toast .toast-message { font-size: .9rem; }
      .toast .toast-close { position: absolute; top: 6px; right: 8px; border: none; background: transparent; cursor: pointer; color: var(--muted-foreground); font-size: 1rem; }
      .toast.success { border-color: color-mix(in srgb, var(--accent) 50%, white 50%); background: color-mix(in srgb, var(--accent) 10%, white 90%); }
      .toast.error { border-color: color-mix(in srgb, var(--destructive) 50%, white 50%); background: color-mix(in srgb, var(--destructive) 10%, white 90%); }
      .toast.info { border-color: color-mix(in srgb, var(--primary) 50%, white 50%); background: color-mix(in srgb, var(--primary) 10%, white 90%); }
      .toast.warning { border-color: color-mix(in srgb, orange 50%, white 50%); background: color-mix(in srgb, orange 10%, white 90%); }
    `}</style>
  );
}