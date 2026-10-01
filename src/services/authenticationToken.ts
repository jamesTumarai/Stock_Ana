export interface TokenUser {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export class AuthenticationTokenTimeoutError extends Error {
  readonly code = 'AUTH_TOKEN_TIMEOUT';
  constructor() {
    super('Sign-in verification timed out. Check your connection and try again.');
    this.name = 'AuthenticationTokenTimeoutError';
  }
}

const aborted = () => new DOMException('The request was cancelled.', 'AbortError');

/** Firebase may keep retrying a token refresh while offline. Bound the wait
 * before sending any authenticated request; a late token never starts a request.
 * This neither logs credentials nor bypasses authentication on failure. */
export async function resolveAuthenticationToken(
  user: TokenUser,
  options: { signal?: AbortSignal | null; forceRefresh?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  if (options.signal?.aborted) throw aborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const interrupted = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AuthenticationTokenTimeoutError()), options.timeoutMs ?? 15000);
      onAbort = () => reject(aborted());
      options.signal?.addEventListener('abort', onAbort, { once: true });
    });
    const token = await Promise.race([user.getIdToken(options.forceRefresh), interrupted]);
    if (options.signal?.aborted) throw aborted();
    if (!token?.trim()) throw new Error('Sign-in verification returned no token. Please sign in again.');
    return token;
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) options.signal?.removeEventListener('abort', onAbort);
  }
}
