import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@morphic/db';
import * as schema from '@morphic/db/schema';
import { captcha } from 'better-auth/plugins';

import { apiKeyAuth } from './auth-api-key';

const authSecret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (!authSecret || authSecret === 'change-me-32+chars-random-secret' || authSecret.length < 32) {
    throw new Error(
      '[FATAL SECURITY] BETTER_AUTH_SECRET must be set to a secure 32+ character random string in production. Generate one using: openssl rand -base64 32',
    );
  }
}

const authPlugins = [apiKeyAuth()];
if (process.env.RECAPTCHA_SECRET_KEY) {
  authPlugins.push(
    captcha({
      provider: 'google-recaptcha',
      secretKey: process.env.RECAPTCHA_SECRET_KEY,
    }),
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes signed cookie cache
    },
  },
  rateLimit: {
    window: 60,
    max: 20, // Tighten rate limit to mitigate brute-force
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  advanced: {
    database: { generateId: false },
  },
  plugins: authPlugins,
});

export type Session = typeof auth.$Infer.Session;
