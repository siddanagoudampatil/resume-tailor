import { GoogleGenAI, Type } from "@google/genai";
// import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";
import type { JobPayload, RunCompleteResponse } from "@resume-agent/shared";
import { slugifySegment, stripLegalSuffix, jobOutputFolder } from "@resume-agent/shared";
import type { AppConfig } from "../config.js";
// import { parseRepoUrl, getFileContent, createPRWithFiles } from "../lib/github.js";
import { type RunStore, sanitizeText } from "./run-store.js";
import { buildRunPrompt } from "./run-prompt.js";
import { findHonestyWarnings, parseDoNotAddTerms } from "./honesty-check.js";

export interface StartRunParams {
	runId: string;
	job: JobPayload;
	repoUrl: string;
	config: AppConfig;
	store: RunStore;
}

// In-memory sessions just to track active run IDs for cancelation
const activeRuns = new Set<string>();

export function getActiveAgentSessionCount(): number {
	return activeRuns.size;
}

export async function shutdownAgentSessions(): Promise<void> {
	// We can't gracefully abort Google GenAI promises if they don't support AbortSignal easily.
	// We'll just clear the active runs.
	activeRuns.clear();
}

export function startAgentRun(params: StartRunParams): void {
	void runGeminiAgent(params).catch((err) => {
		handleAgentRunError(params, err);
	});
}

// Deprecated alias
export const startCloudRunOnly = startAgentRun;
export const startLocalRun = startAgentRun;
export const startCloudRun = startAgentRun;

async function runGeminiAgent(params: StartRunParams): Promise<void> {
	const { runId, job, store } = params;
	activeRuns.add(runId);

	store.setStatus(runId, "running");
	store.setAgentId(runId, "gemini-1.5-pro");
	store.appendEvent(runId, {
		type: "status",
		label: "Fetching resume and skills from GitHub...",
		timestamp: new Date().toISOString(),
	});

	try {
		if (!process.env.GEMINI_API_KEY) {
			throw new Error("GEMINI_API_KEY is not set.");
		}
		// if (!process.env.GITHUB_TOKEN) {
		//   throw new Error("GITHUB_TOKEN is not set.");
		// }

		// const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
		// const { owner, repo } = parseRepoUrl(repoUrl);
		// const baseRef = config.cloudStartingRef || "main";

		// 1. Fetch source files from GitHub (Commented out for local testing)

		// We assume this runs from either workspace root or apps/api
		const rootDir = process.cwd().endsWith("api") ? path.join(process.cwd(), "../../") : process.cwd();

		const resumeTex = await fs.readFile(path.join(rootDir, "resume.tex"), "utf-8");
		const skillMd = await fs.readFile(path.join(rootDir, "agent-skills/SKILL.md"), "utf-8");

		const referencesToFetch = [
			"agent-skills/references/jd-extraction-taxonomy.md",
			"agent-skills/references/fit-report.md",
			"agent-skills/references/keyword-alignment.md",
			"agent-skills/references/markdown-resume-structure.md",
			"agent-skills/references/change-summary.md",
			"agent-skills/references/anti-patterns.md",
			"agent-skills/references/agent-governance.md",
		];

		let referencesText = "";
		for (const ref of referencesToFetch) {
			try {
				const content = await fs.readFile(path.join(rootDir, ref), "utf-8");
				referencesText += `\n--- ${ref} ---\n${content}\n`;
			} catch (e) {
				// Silently skip missing references
			}
		}

		// 2. Prepare the prompt for Gemini
		store.appendEvent(runId, {
			type: "status",
			label: "Generating tailored resume with Gemini...",
			timestamp: new Date().toISOString(),
		});

		const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
		const systemInstruction = `
You are the Resume Agent.
Your job is to tailor the user's resume for a specific job application.
Follow the skill instructions strictly. DO NOT hallucinate or invent experience.

=== SKILL.md ===
${skillMd}

=== REFERENCES ===
${referencesText}

=== SOURCE RESUME (resume.tex) ===
${resumeTex}
`;

		const userPrompt = buildRunPrompt(job);

		const response = await ai.models.generateContent({
			model: "gemini-2.5-flash-lite",
			contents: userPrompt,
			config: {
				systemInstruction: systemInstruction,
				temperature: 0.1,
				responseMimeType: "application/json",
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						fitReport: { type: Type.STRING, description: "Markdown content for fit-report.md" },
						tailoredResume: { type: Type.STRING, description: "LaTeX content for tailored-resume.tex" },
						changeSummary: { type: Type.STRING, description: "Markdown content for change-summary.md" },
					},
					required: ["fitReport", "tailoredResume", "changeSummary"],
				},
			},
		});

		if (!response.text) {
			throw new Error("Received empty response from Gemini.");
		}

		const resultData = JSON.parse(response.text);
		const { fitReport, tailoredResume, changeSummary } = resultData;

		// 3. Create PR via GitHub (Commented out for local testing)
		store.appendEvent(runId, {
			type: "status",
			label: "Saving generated files locally...",
			timestamp: new Date().toISOString(),
		});

		const companySlug = slugifySegment(stripLegalSuffix(job.company));
		const roleSlug = slugifySegment(job.title);
		const basePath = jobOutputFolder(job.company, job.title);
		const branchName = `feat/tailor-${roleSlug}-${companySlug}-${Date.now()}`;

		// Write to local folder
		const fullBasePath = path.join(rootDir, basePath);
		await fs.mkdir(fullBasePath, { recursive: true });

		await fs.writeFile(path.join(fullBasePath, "fit-report.md"), fitReport, "utf-8");
		await fs.writeFile(path.join(fullBasePath, "tailored-resume.tex"), tailoredResume, "utf-8");
		await fs.writeFile(path.join(fullBasePath, "change-summary.md"), changeSummary, "utf-8");

		/*
    const files = [
      { path: `${basePath}/fit-report.md`, content: fitReport },
      { path: `${basePath}/tailored-resume.tex`, content: tailoredResume },
      { path: `${basePath}/change-summary.md`, content: changeSummary },
    ];

    const prUrl = await createPRWithFiles(
      octokit,
      owner,
      repo,
      baseRef,
      branchName,
      files,
      `feat: tailor resume for ${job.title} at ${job.company}`
    );
    */
		const prUrl = `file://${fullBasePath}`;

		// 4. Complete
		const outputPaths = {
			fitReport: `${basePath}/fit-report.md`,
			tailoredResume: `${basePath}/tailored-resume.tex`,
			changeSummary: `${basePath}/change-summary.md`,
		};

		let responsePayload: RunCompleteResponse = {
			runId,
			agentId: "gemini-1.5-pro",
			status: "succeeded",
			prUrl,
			branch: branchName,
			outputPaths,
			warnings: [],
		};

		responsePayload = attachHonestyWarnings(responsePayload, fitReport, tailoredResume);

		store.appendEvent(runId, {
			type: "complete",
			label: "PR opened",
			timestamp: new Date().toISOString(),
		});

		store.complete(runId, responsePayload);
	} catch (err) {
		const message = err instanceof Error ? sanitizeText(err.message) : "Unknown error";
		store.fail(runId, message);
		store.complete(runId, {
			runId,
			agentId: "gemini-1.5-pro",
			status: "failed",
			error: message,
		});
	} finally {
		activeRuns.delete(runId);
	}
}

function handleAgentRunError(params: StartRunParams, err: unknown): void {
	const { runId, store } = params;
	const run = store.get(runId);
	if (!run || run.status === "succeeded" || run.status === "failed") {
		return;
	}
	store.fail(runId, err instanceof Error ? sanitizeText(err.message) : "Unknown error");
}

export function attachHonestyWarnings(response: RunCompleteResponse, fitReportMarkdown: string, tailoredResumeMarkdown: string): RunCompleteResponse {
	const terms = parseDoNotAddTerms(fitReportMarkdown);
	const warnings = findHonestyWarnings(tailoredResumeMarkdown, terms);
	if (!warnings.length) return response;
	return { ...response, warnings: [...(response.warnings ?? []), ...warnings] };
}
