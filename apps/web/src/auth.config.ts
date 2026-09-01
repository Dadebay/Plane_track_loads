/**
 * Edge-safe Auth.js config — no Credentials provider, no argon2, no
 * database access. This is the config middleware.ts uses (middleware runs
 * on the Edge runtime, which cannot bundle native Node addons like
 * argon2's node:crypto binding). The full config with the real
 * Credentials provider lives in auth.ts, which only ever runs in the
 * Node.js runtime (API route, server actions, server components).
 */

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@tua/db";

const SHIFT_SESSION_SECONDS = 8 * 60 * 60;

export const authConfig: NextAuthConfig = {
  // Auth.js validates the incoming Host header against a trusted value by
  // default (Vercel sets this automatically; self-hosted deployments —
  // bare IP, no reverse proxy in front yet — must opt in explicitly, or
  // every auth() call throws UntrustedHost and middleware silently treats
  // the request as unauthenticated instead of redirecting to /login).
  trustHost: true,
  session: { strategy: "jwt", maxAge: SHIFT_SESSION_SECONDS },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role as Role;
        token.stationId = user.stationId as string | null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.stationId = token.stationId as string | null;
      }
      return session;
    },
  },
};
