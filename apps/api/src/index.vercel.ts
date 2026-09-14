import { handle } from 'hono/vercel';
import { app } from './app';

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false,
  },
};

// Max duration for Vercel Hobby plan (60s max)
export const maxDuration = 60;

export default handle(app);

