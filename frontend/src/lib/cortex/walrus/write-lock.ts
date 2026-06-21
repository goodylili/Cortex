// Walrus writes are paid from the user's single owned WAL coin. The Walrus SDK
// selects and spends that coin across a multi-step writeBlob (register storage,
// then certify), so two writeBlob sequences running at once both grab the same coin
// version: the second is rejected as equivocation ("object ... already locked by a
// different transaction"), which locks the coin until the epoch ends. Run every
// Walrus blob write through this global mutex so each full sequence finishes  -  coin
// spent and settled  -  before the next begins. A failed write still frees the lock.
let walrusWriteChain: Promise<unknown> = Promise.resolve();

export function withWalrusWrite<T>(work: () => Promise<T>): Promise<T> {
  const run = walrusWriteChain.then(work, work);
  walrusWriteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
