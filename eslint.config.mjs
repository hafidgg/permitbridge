// ESLint v9 "flat config". Next.js 16 dropped the built-in `next lint`
// command (see PIPELINE-fix notes in README), so linting now runs via the
// plain `eslint .` CLI (see package.json "lint" script). This file bridges
// eslint-config-next's classic shareable config into flat-config format
// using the official compatibility layer, per Next.js's own migration docs.
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "out/**"],
  },
];

export default eslintConfig;
