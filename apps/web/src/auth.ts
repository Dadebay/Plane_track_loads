/**
 * Full Auth.js v5 config — Credentials provider with argon2 verification
 * against @tua/db. Node.js runtime only (never imported by middleware.ts,
 * which uses the Edge-safe auth.config.ts instead — see that file's
 * comment for why).
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { db } from "@tua/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        const valid = await verify(user.passwordHash, password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          stationId: user.stationId,
        };
      },
    }),
  ],
});
