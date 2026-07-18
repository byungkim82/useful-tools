// Small async helpers, kept pure (no DOM/React) so they can be unit-tested.

/**
 * Reject with a "timed out" error if `p` doesn't settle within `ms`; otherwise pass its result through.
 * The timer is cleared as soon as `p` settles, so a resolved promise leaves no dangling timeout.
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}
