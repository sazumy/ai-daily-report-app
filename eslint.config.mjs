import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".next/**"],
  },
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // 未使用変数はエラー（_prefix で無視可）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // any 型は警告
      "@typescript-eslint/no-explicit-any": "warn",
      // import type の統一
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      // console.log は警告（warn/error は許可）
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  }
);
