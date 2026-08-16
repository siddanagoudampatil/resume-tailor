# Gemini Resume Tailor Workspace Rules

This repository contains the Resume Tailor project, structured as a `pnpm` monorepo. Please adhere to these guidelines when working in this codebase.

## Repository Structure

- [`apps/api`](file:///mnt/d/projects/ml/resume-tailor/apps/api): Express API backend that orchestrates Gemini and interacts with GitHub.
- [`apps/extension`](file:///mnt/d/projects/ml/resume-tailor/apps/extension): Chrome Extension (MV3) built with Vite and TypeScript.
- [`packages/shared`](file:///mnt/d/projects/ml/resume-tailor/packages/shared): Shared TypeScript types and utilities.
- [`agent-skills/`](file:///mnt/d/projects/ml/resume-tailor/agent-skills): The core tailoring prompts and taxonomies.
- [`resume.md`](file:///mnt/d/projects/ml/resume-tailor/resume.md): Canonical markdown resume.
- [`jobs/`](file:///mnt/d/projects/ml/resume-tailor/jobs): Output folder for tailored resumes.

## Coding Standards

- **TypeScript**: Always use TypeScript with strict type checking.
- **Node.js API**:
  - Use `@google/genai` for all Google Gemini API calls (specifically Gemini 1.5 Pro).
  - Use `@octokit/rest` for all GitHub API interactions.
  - Do not use `@cursor/sdk` or legacy Gemini packages.
- **Chrome Extension**:
  - MV3 structure using Vite.
  - Use clean vanilla CSS for styling unless Tailwind CSS is explicitly configured.

## Customization & Skills

- The `agent-skills/` directory contains the official prompt templates and taxonomy instructions. Any changes to the tailoring logic should be reflected there.
- Do not modify `resume.md` on the `main` branch. Any tailored resumes must be committed to the appropriate subdirectory in `jobs/` on an agent branch.
