import Script from 'next/script';

const CHUNK_LOAD_RECOVERY_SCRIPT = `
(() => {
  const isChunkLoadError = (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason || '');
    return /ChunkLoadError|Loading chunk \\d+ failed|Failed to fetch dynamically imported module/i.test(message);
  };
  const recover = (reason) => {
    if (!isChunkLoadError(reason)) return;
    const message = reason instanceof Error ? reason.message : String(reason || '');
    // Retry once per failed bundle. A new deployment can produce a different
    // chunk error, which should not be blocked by an old session-wide retry.
    const recoveryKey = 'admin-chunk-load-recovery:' + encodeURIComponent(message);
    if (sessionStorage.getItem(recoveryKey)) return;
    sessionStorage.setItem(recoveryKey, 'true');
    window.location.reload();
  };
  window.addEventListener('error', (event) => recover(event.error || event.message), true);
  window.addEventListener('unhandledrejection', (event) => recover(event.reason));
})();
`;

/** Refreshes once when a deployment replaces a route bundle during page load. */
export function ChunkLoadRecovery() {
  return (
    // This must execute before the initial route chunk is requested.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="admin-chunk-load-recovery" strategy="beforeInteractive">
      {CHUNK_LOAD_RECOVERY_SCRIPT}
    </Script>
  );
}
