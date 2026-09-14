import { handle } from '@hono/node-server/vercel';
import { app } from './app';

export const config = { runtime: 'nodejs' };

export default handle(app);

