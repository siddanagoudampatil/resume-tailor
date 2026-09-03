import {
  buildExtractResult,
  queryDescription,
  queryText,
} from "./extract.js";

function extractLinkedInJob() {
  const root = document.querySelector(".jobs-search__job-details, .job-view-layout, .jobs-details, #job-details") || document;

  const title = queryText([
    ".job-details-jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    "h1.t-24",
    root !== document ? "h1" : "",
  ].filter(Boolean), root);

  const company = queryText([
    ".job-details-jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__primary-description a",
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__company-name",
  ], root);

  const description = queryDescription([
    "#job-details",
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".jobs-description-content__text",
  ], root);

  let url = window.location.href;
  try {
    const parsed = new URL(url);
    const jobId = parsed.searchParams.get("currentJobId");
    if (jobId) {
      url = `https://www.linkedin.com/jobs/view/${jobId}/`;
    } else {
      const match = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
      if (match && match[1]) {
        url = `https://www.linkedin.com/jobs/view/${match[1]}/`;
      }
    }
  } catch {}

  return buildExtractResult({
    title: title || "Unknown role",
    company: company || "Unknown company",
    url,
    description,
  });
}

const result = extractLinkedInJob();
chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: result });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXTRACT_JOB") {
    const fresh = extractLinkedInJob();
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: fresh });
    sendResponse({ payload: fresh });
  }
});
