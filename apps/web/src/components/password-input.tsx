"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  id,
  name,
  label,
  required,
  autoComplete,
}: {
  id?: string;
  name: string;
  label: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const t = useTranslations("auth");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-muted" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative mb-6">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          className="h-11 w-full rounded-lg border border-border bg-bg px-3.5 pr-11 text-fg outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-fg-subtle hover:text-fg"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </>
  );
}
