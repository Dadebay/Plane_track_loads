"use client";

import { Lock, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * What a controller sees once a plan is finalized, and how they correct it.
 *
 * A finalized plan is not editable (CLAUDE.md rule #5), but "not editable"
 * is only half an answer: something went wrong on the ramp often enough
 * that the question is not *whether* it can be corrected but *how*. Before
 * this, the Save and Finalize buttons simply stayed on screen next to a
 * plate that no longer accepted input — so the only thing a controller
 * could do was press them again and silently record another version with
 * the same numbers.
 *
 * So the bar states the rule, and offers the one action that respects it:
 * start the next version from this one. The correction is a new version,
 * the finalized one is kept and marked superseded, and the documents
 * already issued against it stay valid until a new edition is generated.
 */
export function FinalizedBar({ version, onAmend }: { version: number; onAmend: () => void }) {
  const t = useTranslations("loadPlan");

  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-bg p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-fg-muted sm:items-center">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle sm:mt-0" aria-hidden="true" />
        <span>{t("finalizedExplanation", { version })}</span>
      </p>
      <button
        type="button"
        onClick={onAmend}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand hover:brightness-110 sm:h-9"
      >
        <PencilLine className="h-4 w-4" aria-hidden="true" />
        {t("amend", { version: version + 1 })}
      </button>
    </div>
  );
}

/**
 * The banner over a correction in progress.
 *
 * Without it the page looks exactly like an ordinary draft, and a
 * controller correcting version 2 cannot tell that saving will retire it.
 */
export function AmendingNotice({ version, onCancel }: { version: number; onCancel: () => void }) {
  const t = useTranslations("loadPlan");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning bg-warning-bg p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-fg">{t("amendingNotice", { previous: version, next: version + 1 })}</span>
      <button
        type="button"
        onClick={onCancel}
        className="h-9 shrink-0 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
      >
        {t("amendCancel")}
      </button>
    </div>
  );
}
