/** Bound a foreground wait when an SDK retries indefinitely (offline/quota).
 * This does not cancel the underlying operation. A timed-out report save must
 * stop before publishing its manifest; incomplete records stay out of History. */
export async function withDeadline<T>(operation: Promise<T>, label: string, timeoutMs = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out. Cloud storage may be offline or over quota; saving has not been confirmed.`)), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
