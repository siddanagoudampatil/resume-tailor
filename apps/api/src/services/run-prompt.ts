import { jobOutputFolder, type JobPayload } from "@resume-agent/shared";

export function buildRunPrompt(job: JobPayload): string {
  const folder = jobOutputFolder(job.company, job.title);
  return [
    "Use the tailor-resume skill for this run. Read resume.md as the source of truth.",
    "",
    `Company: ${job.company}`,
    `Role: ${job.title}`,
    `Job URL: ${job.url?.trim() || "N/A"}`,
    "",
    "Write outputs to:",
    `- ${folder}/fit-report.md`,
    `- ${folder}/tailored-resume.md`,
    `- ${folder}/tailored-resume.tex`,
    `- ${folder}/cover-letter.tex`,
    `- ${folder}/change-summary.md`,
    "",
    "Open a PR titled: feat: tailor resume for " +
      `${job.title} at ${job.company}`,
    "",
    "Job description:",
    job.description,
  ].join("\n");
}

export function outputPathsForJob(job: JobPayload) {
  const folder = jobOutputFolder(job.company, job.title);
  return {
    fitReport: `${folder}/fit-report.md`,
    tailoredResume: `${folder}/tailored-resume.md`,
    tailoredResumeTex: `${folder}/tailored-resume.tex`,
    coverLetterTex: `${folder}/cover-letter.tex`,
    changeSummary: `${folder}/change-summary.md`,
  };
}
