import type { JobExtractResult } from "@resume-agent/shared";
import { applyDefaultSettings } from "../shared/apply-default-settings.js";

let lastExtract: JobExtractResult | undefined;

chrome.runtime.onInstalled.addListener(() => {
  void applyDefaultSettings();
});

void applyDefaultSettings();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOB_EXTRACTED") {
    lastExtract = message.payload as JobExtractResult;
    void chrome.storage.local.set({ lastExtract });
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "GET_LAST_EXTRACT") {
    if (lastExtract) {
      sendResponse({ payload: lastExtract });
      return;
    }
    void chrome.storage.local
      .get(["lastExtract"])
      .then((stored) => {
        const payload = (stored.lastExtract as JobExtractResult) || undefined;
        if (payload) {
          lastExtract = payload;
        }
        sendResponse({ payload });
      })
      .catch(() => {
        sendResponse({ payload: undefined });
      });
    return true;
  }

  if (message?.type === "API_FETCH") {
    const { url, init } = message as {
      url: string;
      init: RequestInit;
    };
    fetch(url, init)
      .then(async (res) => {
        const text = await res.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          /* plain text */
        }
        sendResponse({
          ok: res.ok,
          status: res.status,
          body,
        });
      })
      .catch((err: Error) => {
        sendResponse({ ok: false, status: 0, error: err.message });
      });
    return true;
  }
});
