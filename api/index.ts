import { createApp } from '../server.ts';

let appPromise: ReturnType<typeof createApp> | undefined;

export const config = {
  maxDuration: 300,
};

export default async function handler(req: any, res: any) {
  appPromise ??= createApp({ serveFrontend: false });
  const app = await appPromise;
  return app(req, res);
}
