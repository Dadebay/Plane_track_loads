"use server";

import { revalidatePath } from "next/cache";
import { hash } from "argon2";
import { z } from "zod";
import { db, Prisma } from "@tua/db";
import { auth } from "@/auth";

const ROLES = ["ADMIN", "LOAD_CONTROLLER", "CHECKER", "RAMP", "VIEWER"] as const;

/** Long enough to survive a guess, short enough that a controller will not
 * write it on the console. Checked here as well as in the browser, because
 * a server action is a public endpoint however the form behaves. */
const MIN_PASSWORD_LENGTH = 8;

const createSchema = z.object({
  name: z.string().trim().min(1, "requiredField"),
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  role: z.enum(ROLES),
  stationId: z.string().optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH, "passwordTooShort"),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "requiredField"),
  role: z.enum(ROLES),
  stationId: z.string().optional(),
  active: z.boolean(),
});

const passwordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH, "passwordTooShort"),
});

export type CreateUserInput = z.infer<typeof createSchema>;
export type UpdateUserInput = z.infer<typeof updateSchema>;

export interface UserActionResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

/**
 * Everything here is ADMIN-only, checked against the session rather than the
 * form: `middleware.ts` keeps the pages out of reach, but a server action can
 * be called directly, so the role is re-read from the session on every call.
 */
async function requireAdmin(): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return { id: session.user.id, role: session.user.role };
}

/** Never log a hash or a password, only what changed around it. */
async function writeAudit(
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  actorId: string,
): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      entity: "User",
      entityId,
      before: (before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      actorId,
    },
  });
}

export async function createUser(input: CreateUserInput): Promise<UserActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "unauthorized" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) return { ok: false, error: "duplicateEmail" };

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      stationId: data.stationId || null,
      passwordHash: await hash(data.password),
    },
  });

  await writeAudit(
    "USER_CREATE",
    user.id,
    null,
    { name: user.name, email: user.email, role: user.role, stationId: user.stationId, active: user.active },
    actor.id,
  );
  revalidatePath("/admin/users");
  return { ok: true, userId: user.id };
}

export async function updateUser(input: UpdateUserInput): Promise<UserActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "unauthorized" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };
  const data = parsed.data;

  const before = await db.user.findUnique({ where: { id: data.id } });
  if (!before) return { ok: false, error: "notFound" };

  // An admin who demotes or deactivates their own account loses the screen
  // they are standing on, and if they are the last one nobody can undo it.
  if (data.id === actor.id && (data.role !== "ADMIN" || !data.active)) {
    return { ok: false, error: "cannotLockSelfOut" };
  }
  if (before.role === "ADMIN" && (data.role !== "ADMIN" || !data.active)) {
    const otherAdmins = await db.user.count({
      where: { role: "ADMIN", active: true, id: { not: data.id } },
    });
    if (otherAdmins === 0) return { ok: false, error: "lastAdmin" };
  }

  const user = await db.user.update({
    where: { id: data.id },
    data: { name: data.name, role: data.role, stationId: data.stationId || null, active: data.active },
  });

  await writeAudit(
    "USER_UPDATE",
    user.id,
    { name: before.name, role: before.role, stationId: before.stationId, active: before.active },
    { name: user.name, role: user.role, stationId: user.stationId, active: user.active },
    actor.id,
  );
  revalidatePath("/admin/users");
  return { ok: true, userId: user.id };
}

/**
 * Sets a new password without asking for the old one — this is the admin
 * path for someone who has lost theirs, not a self-service change. The audit
 * row records that it happened and by whom; the password itself never leaves
 * the request.
 */
export async function resetUserPassword(id: string, password: string): Promise<UserActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "unauthorized" };

  const parsed = passwordSchema.safeParse({ id, password });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation" };

  const user = await db.user.findUnique({ where: { id: parsed.data.id } });
  if (!user) return { ok: false, error: "notFound" };

  await db.user.update({
    where: { id: parsed.data.id },
    data: { passwordHash: await hash(parsed.data.password) },
  });

  await writeAudit("USER_PASSWORD_RESET", user.id, null, { email: user.email }, actor.id);
  revalidatePath("/admin/users");
  return { ok: true, userId: user.id };
}
