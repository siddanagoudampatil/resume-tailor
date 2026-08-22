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
	const { runId, job, store, config } = params;
	activeRuns.add(runId);

	store.setStatus(runId, "running");
	store.setAgentId(runId, config.geminiModel);
	store.appendEvent(runId, {
		type: "status",
		label: "Reading resume and skills from local workspace...",
		timestamp: new Date().toISOString(),
	});

	try {
		if (!process.env.GEMINI_API_KEY) {
			throw new Error("GEMINI_API_KEY is not set.");
		}
		
		// ==========================================
		// SECTIONS THAT UPDATE OR READ FROM GITHUB (DISABLED FOR LOCAL RUN)
		// ==========================================
		// if (!process.env.GITHUB_TOKEN) {
		//   throw new Error("GITHUB_TOKEN is not set.");
		// }

		// const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
		// const { owner, repo } = parseRepoUrl(repoUrl);
		// const baseRef = config.cloudStartingRef || "main";

		// 1. Fetch source files from GitHub (Disabled: reading from local disk instead)
		// ==========================================

		// We assume this runs from either workspace root or apps/api
		const rootDir = process.cwd().endsWith("api") ? path.join(process.cwd(), "../../") : process.cwd();

		const resumeMd = await fs.readFile(path.join(rootDir, "resume.md"), "utf-8");
		const resumeTex = await fs.readFile(path.join(rootDir, "resume.tex"), "utf-8");
		const coverLetterTemplate = await fs.readFile(path.join(rootDir, "cover-letter.tex"), "utf-8");
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

Identify the hiring company name and the target job role name from the job description and job role title provided in the prompt. Do not use the Job URL to infer the company name. Strip legal entity suffixes from the company name (e.g., "Acme Inc." -> "Acme"). Return these as "company" and "role" in the output JSON.

=== SKILL.md ===
${skillMd}

=== REFERENCES ===
${referencesText}

=== SOURCE RESUME (resume.md) ===
${resumeMd}

=== LATEX TEMPLATE (resume.tex) ===
${resumeTex}

=== COVER LETTER TEMPLATE (cover-letter.tex) ===
${coverLetterTemplate}
`;

		const userPrompt = buildRunPrompt(job);

		const response = await ai.models.generateContent({
			model: config.geminiModel,
			contents: userPrompt,
			config: {
				systemInstruction: systemInstruction,
				temperature: 0.1,
				responseMimeType: "application/json",
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						company: { type: Type.STRING, description: "The name of the company hiring for this role, extracted from the job title and description. Strip legal entity suffixes (e.g. Inc, LLC, Ltd)." },
						role: { type: Type.STRING, description: "The specific job title/role, cleaned from the job title and description (e.g. 'Senior Frontend Engineer')." },
						fitReport: { type: Type.STRING, description: "Markdown content for fit-report.md" },
						tailoredResume: { type: Type.STRING, description: "Markdown content for tailored-resume.md" },
						tailoredResumeTex: { type: Type.STRING, description: "LaTeX content for tailored-resume.tex matching the structure and commands of resume.tex but with tailored details" },
						coverLetterTex: { type: Type.STRING, description: "LaTeX content for cover-letter.tex matching the structure of cover-letter.tex but with recipient, role, date, and tailored contents customized for the job description. Focus on highlighting how the candidate's skills map to the job requirements and why they are the best fit, rather than just repeating the resume." },
						changeSummary: { type: Type.STRING, description: "Markdown content for change-summary.md" },
					},
					required: ["company", "role", "fitReport", "tailoredResume", "tailoredResumeTex", "coverLetterTex", "changeSummary"],
				},
			},
		});

		if (!response.text) {
			throw new Error("Received empty response from Gemini.");
		}

		const resultData = JSON.parse(response.text);
		const {
			company: extractedCompany,
			role: extractedRole,
			fitReport,
			tailoredResume,
			tailoredResumeTex,
			coverLetterTex,
			changeSummary
		} = resultData;

		// 3. Create PR via GitHub (Commented out for local testing)
		store.appendEvent(runId, {
			type: "status",
			label: "Saving generated files locally...",
			timestamp: new Date().toISOString(),
		});

		const companyName = extractedCompany?.trim() || job.company;
		const roleName = extractedRole?.trim() || job.title;

		const companySlug = slugifySegment(stripLegalSuffix(companyName));
		const roleSlug = slugifySegment(roleName);
		const basePath = jobOutputFolder(companyName, roleName);
		const branchName = `feat/tailor-${roleSlug}-${companySlug}-${Date.now()}`;

		// Write to local folder
		const fullBasePath = path.join(rootDir, basePath);
		await fs.mkdir(fullBasePath, { recursive: true });

		await fs.writeFile(path.join(fullBasePath, "fit-report.md"), fitReport, "utf-8");
		await fs.writeFile(path.join(fullBasePath, "tailored-resume.md"), tailoredResume, "utf-8");
		await fs.writeFile(path.join(fullBasePath, "tailored-resume.tex"), tailoredResumeTex, "utf-8");
		await fs.writeFile(path.join(fullBasePath, "cover-letter.tex"), coverLetterTex, "utf-8");
		await fs.writeFile(path.join(fullBasePath, "change-summary.md"), changeSummary, "utf-8");

		// ==========================================
		// SECTIONS THAT UPDATE OR READ FROM GITHUB (DISABLED FOR LOCAL RUN)
		// ==========================================
		/*
		const files = [
			{ path: `${basePath}/fit-report.md`, content: fitReport },
			{ path: `${basePath}/tailored-resume.md`, content: tailoredResume },
			{ path: `${basePath}/tailored-resume.tex`, content: tailoredResumeTex },
			{ path: `${basePath}/cover-letter.tex`, content: coverLetterTex },
			{ path: `${basePath}/change-summary.md`, content: changeSummary },
		];

		const prUrl = await createPRWithFiles(
			octokit,
			owner,
			repo,
			baseRef,
			branchName,
			files,
			`feat: tailor resume for ${roleName} at ${companyName}`
		);
		*/
		// ==========================================
		const prUrl = `file://${fullBasePath}`;

		// 4. Complete
		const outputPaths = {
			fitReport: `${basePath}/fit-report.md`,
			tailoredResume: `${basePath}/tailored-resume.md`,
			tailoredResumeTex: `${basePath}/tailored-resume.tex`,
			coverLetterTex: `${basePath}/cover-letter.tex`,
			changeSummary: `${basePath}/change-summary.md`,
		};

		let responsePayload: RunCompleteResponse = {
			runId,
			agentId: config.geminiModel,
			status: "succeeded",
			prUrl,
			branch: branchName,
			outputPaths,
			warnings: [],
		};

		responsePayload = attachHonestyWarnings(responsePayload, fitReport, tailoredResume);

		store.appendEvent(runId, {
			type: "complete",
			label: "Resume tailored and saved locally!",
			timestamp: new Date().toISOString(),
		});

		store.complete(runId, responsePayload);
	} catch (err) {
		const message = err instanceof Error ? sanitizeText(err.message) : "Unknown error";
		store.fail(runId, message);
		store.complete(runId, {
			runId,
			agentId: config.geminiModel,
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
