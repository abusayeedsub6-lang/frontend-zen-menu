/**
 * Lightweight polling helper for surfaces that can no longer rely on
 * anon Realtime after Phase 5 RLS (orders are not selectable by anon).
 */
export function startPolling(callback, intervalMs = 8000) {
  let stopped = false;
  let timerId = null;
  let inFlight = false;

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      await callback();
    } catch (error) {
      console.warn('Polling tick failed:', error);
    } finally {
      inFlight = false;
    }
  };

  // Initial refresh shortly after mount, then on interval
  timerId = setTimeout(function loop() {
    tick().finally(() => {
      if (!stopped) {
        timerId = setTimeout(loop, intervalMs);
      }
    });
  }, 500);

  return () => {
    stopped = true;
    if (timerId) clearTimeout(timerId);
  };
}
