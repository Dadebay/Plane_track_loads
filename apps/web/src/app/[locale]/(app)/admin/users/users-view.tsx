"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { KeyRound, Pencil, Plus, X } from "lucide-react";
import { DataTable, StatusBadge, type DataTableColumn } from "@tua/ui";
import { PageHeader } from "@/components/page-header";
import { useRouter } from "@/i18n/navigation";
import { createUser, resetUserPassword, updateUser } from "./actions";

const ROLES = ["ADMIN", "LOAD_CONTROLLER", "CHECKER", "RAMP", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  stationId: string | null;
  stationIata: string | null;
  createdAt: string;
}

export interface StationOption {
  id: string;
  iata: string;
  name: string;
}

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

/**
 * Who may use the system, and as what.
 *
 * Accounts are never deleted — a user is on finalized documents as the one
 * who prepared or checked them, and those rows are insert-only (CLAUDE.md
 * rule 5). Taking someone's access away is therefore "active off", which
 * leaves the signature on the paperwork intact while the login stops
 * working.
 */
export function UsersView({ users, stations }: { users: UserRow[]; stations: StationOption[] }) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("account.roles");
  const router = useRouter();
  const { data: session } = useSession();

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  function done() {
    setEditing(null);
    setCreating(false);
    setResetting(null);
    router.refresh();
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "name",
      header: t("name"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-fg">{row.name}</span>
          <span className="text-xs text-fg-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: t("role"),
      render: (row) => <span className="text-fg">{tRoles(row.role as Role)}</span>,
    },
    {
      key: "station",
      header: t("station"),
      render: (row) => <span className="text-fg-muted">{row.stationIata ?? t("noStation")}</span>,
    },
    {
      key: "active",
      header: t("status"),
      render: (row) => (
        <StatusBadge tone={row.active ? "success" : "neutral"}>
          {row.active ? t("active") : t("inactive")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(row)}
            aria-label={t("editUser", { name: row.name })}
            className="rounded-md p-2 text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setResetting(row)}
            aria-label={t("resetPasswordFor", { name: row.name })}
            className="rounded-md p-2 text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-11 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 sm:h-9"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addUser")}
          </button>
        }
      />

      <div className="px-4 pb-6 sm:px-6">
        <p className="mb-3 text-xs text-fg-subtle">{t("neverDeleted")}</p>
        <DataTable columns={columns} rows={users} rowKey={(row) => row.id} />
      </div>

      {creating ? <UserFormModal stations={stations} onClose={() => setCreating(false)} onSaved={done} /> : null}
      {editing ? (
        <UserFormModal
          stations={stations}
          editing={editing}
          isSelf={editing.id === session?.user?.id}
          onClose={() => setEditing(null)}
          onSaved={done}
        />
      ) : null}
      {resetting ? (
        <PasswordResetModal user={resetting} onClose={() => setResetting(null)} onSaved={done} />
      ) : null}
    </div>
  );
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const tCommon = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-bg-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserFormModal({
  stations,
  editing,
  isSelf,
  onClose,
  onSaved,
}: {
  stations: StationOption[];
  editing?: UserRow;
  isSelf?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("account.roles");
  const tCommon = useTranslations("common");

  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [role, setRole] = useState<Role>((editing?.role as Role) ?? "LOAD_CONTROLLER");
  const [stationId, setStationId] = useState(editing?.stationId ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = editing
      ? await updateUser({ id: editing.id, name, role, stationId: stationId || undefined, active })
      : await createUser({ name, email, role, stationId: stationId || undefined, password });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "validation");
      return;
    }
    onSaved();
  }

  return (
    <ModalFrame title={editing ? t("editTitle") : t("addUser")} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        {error ? (
          <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
            {t(`errors.${error}` as never)}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            {t("name")}
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("email")}
            {/* An account's address identifies it on every document it signs,
                so it is set once at creation rather than edited later. */}
            <input
              required
              type="email"
              value={email}
              disabled={Boolean(editing)}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            {t("role")}
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {tRoles(r)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {t("station")}
            <select value={stationId} onChange={(e) => setStationId(e.target.value)} className={inputClass}>
              <option value="">{t("noStation")}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.iata} — {s.name}
                </option>
              ))}
            </select>
          </label>
          {editing ? null : (
            <label className={`${labelClass} sm:col-span-2`}>
              {t("password")}
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <span className="text-[11px] font-normal text-fg-subtle">{t("passwordHint")}</span>
            </label>
          )}
          {editing ? (
            <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
              <input
                type="checkbox"
                checked={active}
                disabled={isSelf}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("activeAccount")}
            </label>
          ) : null}
        </div>

        {isSelf ? <p className="text-xs text-fg-subtle">{t("selfNote")}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:h-9"
          >
            {tCommon("save")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function PasswordResetModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await resetUserPassword(user.id, password);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "validation");
      return;
    }
    onSaved();
  }

  return (
    <ModalFrame title={t("resetPassword")} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        {error ? (
          <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
            {t(`errors.${error}` as never)}
          </p>
        ) : null}
        <p className="text-sm text-fg-muted">{t("resetFor", { name: user.name, email: user.email })}</p>
        <label className={labelClass}>
          {t("newPassword")}
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <span className="text-[11px] font-normal text-fg-subtle">{t("passwordHint")}</span>
        </label>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:h-9"
          >
            {tCommon("save")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
