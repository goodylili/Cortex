// No production docs domain yet, so the default points at the local docs package
// (pnpm dev:docs on port 3001). Set NEXT_PUBLIC_DOCS_URL once docs are deployed.
export const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3001";
