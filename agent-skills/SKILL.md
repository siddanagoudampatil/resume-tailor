---
name: tailor-resume
description: Tailor resume.md for a specific job—fit report, honest tailored resume, change summary, PR-ready outputs.
---

# Tailor resume for one job

## Source of truth

- Read `resume.md` before editing anything.
- JD requirements not supported by `resume.md` go in fit report **Do not add** only—never into `tailored-resume.md`.

## Workflow

1. **Ingest** — Read the per-run prompt (company, role, URL, JD, output paths). Load `references/jd-extraction-taxonomy.md` and classify JD requirements.
2. **Fit report** — Load `references/fit-report.md`. Pick the fit tier from that reference and include the required `**Verdict:**` line. Write `jobs/<company-slug>/<role-slug>/fit-report.md` with **Overall fit**, **Strong matches**, **Gaps**, **Do not add**.
3. **Tailor** — Load `references/keyword-alignment.md` and `references/markdown-resume-structure.md`. Write `tailored-resume.md` by rephrasing/reordering/emphasizing facts from `resume.md` only.
4. **Cover Letter** — Load `cover-letter.tex` as a template. Generate a tailored `cover-letter.tex` using the recipient, role, date, and customized contents. The letter should map candidate skills directly to the key requirements of the job description and highlight why the candidate is the best fit, avoiding simple copy-pasting of the resume in letter format. Maintain the structure and commands of `cover-letter.tex` perfectly.
5. **Change summary** — Load `references/change-summary.md`. Document every meaningful edit in `change-summary.md`.
6. **Quality** — Skim `references/anti-patterns.md` and `references/agent-governance.md`. Optional: note plaintext test steps from `references/export-and-plaintext-test.md`.

## Output paths

Per-run prompt specifies:

- `jobs/<company-slug>/<role-slug>/fit-report.md`
- `jobs/<company-slug>/<role-slug>/tailored-resume.md`
- `jobs/<company-slug>/<role-slug>/tailored-resume.tex`
- `jobs/<company-slug>/<role-slug>/cover-letter.tex`
- `jobs/<company-slug>/<role-slug>/change-summary.md`

Slug rules: lowercase, hyphenated; strip legal suffixes (Inc, LLC, Ltd) from company names.

## PR

Title: `feat: tailor resume for <role> at <company>`

Commit all three files on the agent branch. Do not modify `resume.md` on `main`.
