// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "packages/ahm-data/data/**",
      "packages/db/prisma/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  // JSX-bearing packages: enforce no bare user-facing strings (i18n rule,
  // CLAUDE.md / IMPLEMENTATION_PLAN Faz 1). Numbers and technical
  // abbreviations are allowed.
  {
    files: ["apps/web/src/**/*.tsx", "packages/ui/src/**/*.tsx"],
    plugins: { react: reactPlugin, "react-hooks": reactHooksPlugin },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      "react/jsx-no-literals": [
        "warn",
        {
          noStrings: true,
          allowedStrings: [
            "ULD",
            "ZFW",
            "TOW",
            "LDW",
            "MAC",
            "LIR",
            "LS",
            "ENV",
            "OFF",
            "ON",
            "DEP",
            "ARR",
            "LDM",
            "CPM",
            "MVT",
            "FFM",
            "FBL",
            "AWB",
            "MTOW",
            "MZFW",
            "MLW",
            "MTW",
            "PMC",
            "DOW",
            "DOI",
            "STAB",
            "CG",
            "-",
            "/",
            ":",
            "|",
            "·",
          ],
          ignoreProps: true,
        },
      ],
    },
  },
);
