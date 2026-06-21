import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      // The React Compiler ref rule flags helpers like flash()/saveFinding()
      // that read a ref and are called from event handlers (the correct place);
      // those calls don't run during render, so it is a false positive here.
      "react-hooks/refs": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      ".agents/**",
      ".claude/**",
      "sui/**",
      "mcp/**",
      "src/core/**",
      "scripts/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
