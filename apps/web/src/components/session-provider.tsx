"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { withBasePath } from "@/lib/base-path";

export function SessionProvider({ children }: { children: ReactNode }) {
  // basePath, because Auth.js's client talks to its own route by an absolute
  // path of its own making and knows nothing about Next's basePath: left
  // alone it polls /api/auth/session, which under /load is the main site's
  // 404. useSession() then reports no session on every page that asks, and
  // the document screen — which reads session.user to fill the CHECKED box —
  // silently refuses to generate anything. Setting it here also covers
  // signOut(), which reads the same value from this provider's context.
  return (
    <NextAuthSessionProvider basePath={withBasePath("/api/auth")}>
      {children}
    </NextAuthSessionProvider>
  );
}
