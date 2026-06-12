# Gemini Resume Tailor Walkthrough

I have successfully replaced the `Cursor Cloud Agent SDK` with a native `Gemini 1.5 Pro` orchestration loop, and **completely restructured your workspace** into a single, unified repository!

## What changed?

1. **Unified Workspace Structure:**
   - Both the application code and the resume data are now merged into the root directory (`/mnt/d/projects/ml/resume-tailor/`).
   - Your resume is accessible right at `./resume.md`.
   - Your agent skills and instructions have been moved cleanly from `.cursor/skills/tailor-resume` to a dedicated `./agent-skills/` directory.
   - Redundant templates, multiple READMEs, and old Cursor config folders have been completely removed.

2. **Dependency Swaps:**
   - Removed `@cursor/sdk` from `apps/api`.
   - Installed `@google/genai` (for Gemini access) and `@octokit/rest` (for direct GitHub API interaction).

3. **New Agent Service (`gemini-agent.ts`):**
   - The API now fetches `resume.md` and `agent-skills/SKILL.md` directly from your GitHub repository using Octokit.
   - It invokes `Gemini 1.5 Pro` using **Structured Outputs** (enforced JSON Schema). The temperature is set to `0.1` to ensure the agent strictly follows instructions and does not hallucinate new experience.
   - Once Gemini generates the `fit-report.md`, `tailored-resume.md`, and `change-summary.md`, the backend automatically commits them to a **new branch** on your remote repository and opens a **Pull Request**.

4. **Zero Local Footprint:**
   - The app uses "GitHub's memory" exclusively. It streams the context down into memory during the generation phase and pushes the PR directly via the GitHub API, without cloning repositories or creating local branches on your disk.

## How to use

1. Open `apps/api/.env` and fill in your `GEMINI_API_KEY` and `GITHUB_TOKEN`.
2. Start the API from the root directory: `pnpm --filter @resume-agent/api dev`
3. Load the extension (`apps/extension`) in Chrome and tailor your resume from a job page!
