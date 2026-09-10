import { auth } from '../lib/firebase';

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

  const idToken = await currentUser.getIdToken();
  const inheritedHeaders = input instanceof Request ? input.headers : undefined;
  const headers = new Headers(init.headers ?? inheritedHeaders);
  headers.set('Authorization', `Bearer ${idToken}`);

  return fetch(input, { ...init, headers });
}
