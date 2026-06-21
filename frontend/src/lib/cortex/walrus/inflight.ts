// Tracks Walrus/Sui writes that are in flight so the app can warn the user before
// they close the tab mid-save. A blob write that is interrupted between "uploaded
// to Walrus" and "recorded on Sui" is silent data loss, so any unload while a write
// is pending should prompt the browser's native "Leave site?" confirmation. The
// counter is a plain module value (read synchronously by the beforeunload handler);
// callers wrap each durable write in trackWalrusWrite so the count is exact.

let pending = 0;

export function hasPendingWalrusWrites(): boolean {
  return pending > 0;
}

export async function trackWalrusWrite<T>(work: Promise<T>): Promise<T> {
  pending += 1;
  try {
    return await work;
  } finally {
    if (pending > 0) pending -= 1;
  }
}
