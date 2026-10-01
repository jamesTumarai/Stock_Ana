import { auth } from '../lib/firebase';
import { resolveAuthenticationToken } from './authenticationToken';

export class AuthenticationRequiredError extends Error {
  code = 'AUTH_REQUIRED';

  constructor() {
    super('Please sign in to continue.');
    this.name = 'AuthenticationRequiredError';
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new AuthenticationRequiredError();
  const requestSignal = init.signal === undefined && input instanceof Request ? input.signal : init.signal;

  const idToken = await resolveAuthenticationToken(currentUser, { signal: requestSignal });
  const inheritedHeaders = input instanceof Request ? input.headers : undefined;
  const headers = new Headers(init.headers ?? inheritedHeaders);
  headers.set('Authorization', `Bearer ${idToken}`);

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    try {
      const refreshedToken = await resolveAuthenticationToken(currentUser, { signal: requestSignal, forceRefresh: true });
      if (refreshedToken && refreshedToken !== idToken) {
        headers.set('Authorization', `Bearer ${refreshedToken}`);
        return await fetch(input, { ...init, headers });
      }
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      // Ignore refresh error and return original 401 response
    }
  }

  return response;
}
