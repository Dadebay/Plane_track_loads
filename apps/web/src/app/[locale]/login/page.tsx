import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { Plane } from "lucide-react";
import { signIn } from "@/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { PasswordInput } from "@/components/password-input";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl, error } = await searchParams;
  const t = await getTranslations("auth");
  const tApp = await getTranslations("app");

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : `/${locale}`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/${locale}/login?error=1${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
      }
      throw err;
    }
  }

  return (
    <div
      className="relative flex min-h-dvh flex-col px-4 py-4 sm:px-6 sm:py-6"
      style={{
        backgroundImage: "url(/login-background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark brand-tinted overlay so the form stays readable in both themes — never pure black, per CLAUDE.md dark-mode rule */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, rgba(5,16,10,0.94) 0%, rgba(5,16,10,0.80) 42%, rgba(11,15,14,0.55) 100%)",
        }}
      />

      {/* Header bar — wraps below the brand block on narrow screens so the
          locale/theme controls never force horizontal scroll (CLAUDE.md
          mobile rule: no page may scroll sideways at 375px). */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 shadow-lg shadow-black/30">
            <Plane className="h-5 w-5 text-fg-on-brand" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold text-white">{tApp("name")}</span>
        </div>
        {/* LocaleSwitcher/ThemeToggle are self-contained (own bg/border/text
            tokens) and already theme-aware — no override needed here. A
            forced text-white used to be required when they were bare,
            transparent controls; now it would make light-theme text
            invisible against their own light pill background. */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Centered form */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <form
          action={loginAction}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-subtle/90 p-7 shadow-2xl shadow-black/40 backdrop-blur-md"
        >
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 ring-1 ring-brand-500/30">
              <Plane className="h-6 w-6 text-brand-500" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-fg">{t("signIn")}</h1>
              <p className="mt-1 text-sm text-fg-subtle">{tApp("name")}</p>
            </div>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {t("invalidCredentials")}
            </p>
          ) : null}

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-muted" htmlFor="email">
            {t("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mb-4 h-11 w-full rounded-lg border border-border bg-bg px-3.5 text-fg outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />

          <PasswordInput id="password" name="password" label={t("password")} required autoComplete="current-password" />

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-brand-500 font-semibold text-fg-on-brand shadow-lg shadow-brand-500/20 transition-colors hover:bg-brand-600 active:bg-brand-700"
          >
            {t("signIn")}
          </button>
        </form>
      </div>

      <footer className="relative z-10 text-center text-xs text-white/40">
        {t("footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
