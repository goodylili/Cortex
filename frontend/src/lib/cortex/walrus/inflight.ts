// Tracks Walrus/Sui writes that are in flight so the app can warn the user before
// they close the tab mid-save. A blob write that is interrupted between "uploaded
// to Walrus" and "recorded on Sui" is silent data loss, so any unload while a write
// is pending should prompt the browser's native "Leave site?" confirmation. The
// counter is a plain module value (read synchronously by the beforeunload handler);
// callers wrap each durable write in trackWalrusWrite so the count is exact.

let pending = 0;
const listeners = new Set<() => void>();

export function hasPendingWalrusWrites(): boolean {
  return pending > 0;
}

// Subscribe to changes in the pending-write count. The UI reads this through
// useSyncExternalStore to disable sign-out while a durable write is mid-flight, so
// the wallet is never torn down between "uploaded to Walrus" and "recorded on Sui".
export function subscribePendingWalrusWrites(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyPendingChange(): void {
  for (const listener of listeners) listener();
}

export async function trackWalrusWrite<T>(work: Promise<T>): Promise<T> {
  pending += 1;
  notifyPendingChange();
  try {
    return await work;
  } finally {
    if (pending > 0) pending -= 1;
    notifyPendingChange();
  }
}
