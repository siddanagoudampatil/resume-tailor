# Gemini Resume Agent

**Resume Agent** tailors your markdown resume for a specific job—honestly—from the job page you're already viewing. A Chrome extension captures the role and job description; a local API runs a **Gemini 1.5 Pro** agent directly on your GitHub repository and opens a PR with a fit report, tailored resume, and change summary.

## Architecture

```
Chrome extension  →  apps/api (localhost)  →  Gemini 1.5 Pro  →  your GitHub repo (PR via Octokit)
```

The app handles the generation completely in-memory and pushes the resulting files directly via the GitHub API, maintaining a zero-local-footprint ("GitHub's memory") workflow.

## Workspace Structure

Your application code and your personal resume data live together in this unified repository.

| Folder/Package | Role |
|---------|------|
| `apps/extension` | Chrome Extension (MV3) — extracts job description, confirms, streams progress |
| `apps/api` | Express API — Orchestrates Gemini & GitHub Octokit, handles SSE |
| `packages/shared` | Shared TypeScript contracts |
| `resume.md` | Your canonical markdown resume |
| `agent-skills/` | The exact instructions, rules, and governance the AI must follow |
| `jobs/` | The output directory where tailored resumes and fit reports are saved |

## Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` and configure:

| Variable | Where | Purpose |
|----------|-------|---------|
| `GEMINI_API_KEY` | API only | Google Gemini 1.5 Pro auth |
| `GITHUB_TOKEN` | API only | GitHub auth (Classic with `repo` scope, or Fine-grained with PR access) |
| `BACKEND_SHARED_SECRET` | API + extension | Authorization header `X-Resume-Agent-Token` |
| `PORT` | API | Default `3847` |
| `RESUME_REPO_URL` | API | Your GitHub repository URL |
| `DEV_EXTENSION_ORIGIN` | API | CORS allowlist |

## Quick Start (Local Setup)

1. **Configure Environment:** Set up your `apps/api/.env` as described above.
2. **Start the API:** Run the backend server.
   ```bash
   pnpm install
   pnpm --filter @resume-agent/api dev
   ```
3. **Start the Extension:** In a separate terminal, run the Vite dev server for the extension.
   ```bash
   pnpm --filter @resume-agent/extension dev
   ```
4. **Load the Extension:** 
   - Open Chrome and go to `chrome://extensions/`
   - Turn on **Developer mode**
   - Click **Load unpacked** and select the `apps/extension/dist` folder in this workspace.
5. **Tailor a Resume!**
   - Open a job posting on LinkedIn (or a supported job board).
   - Click the Resume Agent extension icon.
   - Wait 1-2 minutes for Gemini to process.
   - Check your GitHub repository for a brand new Pull Request containing your `fit-report.md` and tailored `resume.md`!

## License

Private / demo — see repo owner.
