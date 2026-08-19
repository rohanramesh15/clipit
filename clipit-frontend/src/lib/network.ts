const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Fetch with a deadline that still respects the page-level cancellation signal.
 * A native fetch has no default timeout, so an unreachable backend can otherwise
 * keep a loading state alive indefinitely.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  const abort = () => controller.abort();

  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener('abort', abort, { once: true });
  }

  const timeoutId = window.setTimeout(abort, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', abort);
  }
}

/** Process a list in a small number of concurrent workers to avoid API bursts. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  maxConcurrent: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(maxConcurrent, 1), items.length) }, worker),
  );
  return results;
}
