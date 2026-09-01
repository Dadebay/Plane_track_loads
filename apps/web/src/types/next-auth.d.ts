import type { Role } from "@tua/db";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    stationId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      stationId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    stationId: string | null;
  }
}
