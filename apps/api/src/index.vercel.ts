import { handle } from '@hono/node-server/vercel';
import { app } from './app';

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false,
  },
};

export default handle(app);

