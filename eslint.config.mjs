import js from "@eslint/js";
import globals from "globals";

// `npm run lint` failed on every run: ESLint 9 only reads a flat config and the project had none.
// Scope is correctness. TypeScript files are covered by `npm run typecheck`; the generated bundles are not linted.
// The UI modules build HTML from strings and guard optional browser APIs with an empty `catch{}`, so that is allowed.
// The tools/ checks run browser modules under Node and install fake DOM/storage globals themselves.
export default [
  { ignores: ["dist/**", ".next/**", ".vinext/**", ".wrangler/**", ".sites-runtime/**", "archive/**", "docs/**", "node_modules/**",
    "lib/generated-shop-domain.mjs", "public/vendor/**", "**/*.ts", "**/*.tsx", "**/*.mts"] },
  js.configs.recommended,
  { files: ["public/**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.browser, ...globals.worker } } },
  { files: ["scripts/**/*.mjs", "tools/**/*.mjs", "worker/**/*.mjs", "*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node, ...globals.browser } } },
  { rules: {
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
    // Stripping control characters from filenames, DXF comments and imported text is deliberate.
    "no-control-regex": "off",
    "no-useless-escape": "warn",
    "no-misleading-character-class": "warn",
  } },
];
