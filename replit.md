# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### `artifacts/ats-optimizer` — ATS CV Optimizer (web, `/`)

Single-page React app where a user uploads a CV (PDF or DOCX, ≤5 MB) and pastes a job description (text or HTTPS URL). The backend extracts text, asks Claude (Anthropic) to optimize the CV against the JD into a Stanford-style template, generates the CV and a tailored cover letter as both PDF and DOCX, and returns an ATS match score with a breakdown (keywords, experience, formatting, completeness) plus a summary (top improvements, missing keywords, next steps).

- Frontend: React + Vite + Tailwind + shadcn/ui + framer-motion + recharts. Phases: idle → validating → processing → success / error. Cardinal-red + warm-beige theme, Fraunces + Inter fonts.
- Backend (`artifacts/api-server`):
  - `POST /api/optimize` — multipart (`cv` file + `jdText` or `jdUrl`).
  - `GET /api/optimize/:sessionId/download/:fileType` — `cv-pdf | cv-docx | cover-letter-pdf | cover-letter-docx`.
  - In-memory `sessionStore` with 15-minute TTL, no DB.
  - Parsing: `pdf-parse` for PDF, `mammoth` for DOCX.
  - Generation: `pdfkit` for PDFs, `docx` for DOCX.
  - JD URL fetch via `undici` (HTTPS only, 3 s timeout, HTML stripped).
  - AI: `@workspace/integrations-anthropic-ai` (`claude-sonnet-4-6`), JSON-only response, normalized server-side.
- Build: `pdfkit`, `fontkit`, and their native helpers are externalized in `build.mjs` so pdfkit can load its bundled `.afm` font files at runtime.
