# Workspace Refactoring Plan

This plan outlines the steps to merge `resume-agent` and `resume-agent-skills` into a single, clean workspace in `/mnt/d/projects/ml/resume-tailor/`, removing any Cursor-specific artifacts and unnecessary example files.

## User Review Required

> [!IMPORTANT]
> **Unified Repository Format:** Merging the two folders means your application code (the Chrome extension and API) and your personal resume data (`resume.md` and `jobs/`) will live in the exact same Git repository. If you plan to make your app code public on GitHub in the future, your personal resume and job tracking will be public as well. Is this acceptable, or would you prefer to keep the resume data separate?

## Open Questions

> [!TIP]
> Do you have any preference for where the `resume.md` and `jobs/` folder should live in the root? (e.g. at the top level `./resume.md`, or inside a dedicated `./data` folder?) I've planned to put them at the top level for simplicity.

## Proposed Changes

### 1. Merge Application Code (`resume-agent`)
- Move all contents of `resume-agent/` (including `apps/`, `packages/`, `package.json`, `pnpm-workspace.yaml`, etc.) to the root workspace folder (`/mnt/d/projects/ml/resume-tailor/`).
- **[DELETE]** `resume-agent/example/` — This is a redundant template of `resume-agent-skills`.
- **[DELETE]** `resume-agent/AGENTS.md` — Agent governance is managed via your skills now.

### 2. Merge Resume Data (`resume-agent-skills`)
- Move `resume.md` to the root (`/mnt/d/projects/ml/resume-tailor/resume.md`).
- Move the `jobs/` directory to the root.
- Move the skills folder from `.cursor/skills/tailor-resume/` into a new root folder called `agent-skills/`.
- **[DELETE]** The `.cursor` folder.
- **[DELETE]** `resume-agent-skills/AGENTS.md` (redundant).

### 3. Clean up root files
- Merge the two `README.md` files into a single unified `README.md`.
- Ensure all `.gitignore` rules are combined.
- Delete the now-empty `resume-agent` and `resume-agent-skills` folders.

### 4. Code Updates

#### [MODIFY] `apps/api/src/services/gemini-agent.ts`
- Update the paths that Gemini fetches from GitHub to match the new structure:
  - `resume.md` (remains root)
  - `agent-skills/SKILL.md`
  - `agent-skills/references/*.md`
- *Note: I noticed during this research that the API was incorrectly looking for `references/` at the root instead of `.cursor/skills/tailor-resume/references/`. This structural refactor will fix that perfectly by making `agent-skills/references/` the standard path!*

## Verification Plan

### Automated Tests
- Run `pnpm install` in the new root to ensure the workspace links correctly.
- Run `pnpm typecheck` to ensure everything still builds.

### Manual Verification
- Review the new folder structure visually to ensure it is clean and intuitive.
