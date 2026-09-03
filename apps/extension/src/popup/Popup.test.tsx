import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { Popup } from "./Popup.js";
import type { RunCompleteResponse } from "@resume-agent/shared";

declare global {
  // React's test utils check this flag before allowing async act().
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("Popup", () => {
  let dom: JSDOM;
  let container: HTMLDivElement;
  let root: Root;
  let syncGet: ReturnType<typeof vi.fn>;
  let localGet: ReturnType<typeof vi.fn>;
  let apiRun: Partial<RunCompleteResponse> | null;

  async function waitFor(assertion: () => void): Promise<void> {
    const startedAt = Date.now();
    let lastError: unknown;

    while (Date.now() - startedAt < 1000) {
      try {
        assertion();
        return;
      } catch (err) {
        lastError = err;
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }

    throw lastError;
  }

  beforeEach(() => {
    dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>");
    globalThis.window = dom.window as unknown as Window & typeof globalThis;
    globalThis.document = dom.window.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.getElementById("root") as HTMLDivElement;
    root = createRoot(container);

    syncGet = vi.fn().mockResolvedValue({
      backendPort: "3847",
      sharedToken: "x".repeat(32),
      resumeRepoUrl: "https://github.com/example/resume",
    });
    localGet = vi.fn().mockResolvedValue({});
    apiRun = null;

    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn((message, callback) => {
          if (message?.type === "GET_LAST_EXTRACT") {
            callback({});
            return;
          }
          if (message?.type === "API_FETCH" && apiRun) {
            callback({ ok: true, status: 200, body: apiRun });
            return;
          }
          callback({ ok: false, status: 0, error: "unexpected request" });
        }),
        openOptionsPage: vi.fn(),
      },
      tabs: {
        query: vi.fn((_query: any, callback?: any) => {
          callback?.([]);
          return Promise.resolve([]);
        }),
        sendMessage: vi.fn(),
      },
      storage: {
        sync: {
          get: syncGet,
        },
        local: {
          get: localGet,
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.restoreAllMocks();
    dom.window.close();
  });

  it("loads settings once when the popup mounts", async () => {
    await act(async () => {
      root.render(<Popup />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(syncGet).toHaveBeenCalledTimes(1);
  });

  it("shows only the pull request link for a successful run with output paths", async () => {
    localGet.mockResolvedValue({ activeRunId: "run-1" });
    apiRun = {
      runId: "run-1",
      status: "succeeded",
      prUrl: "https://github.com/example/resume/pull/1",
      outputPaths: {
        fitReport: "jobs/acme/engineer/fit-report.md",
        tailoredResume: "jobs/acme/engineer/tailored-resume.md",
        changeSummary: "jobs/acme/engineer/change-summary.md",
      },
    };

    await act(async () => {
      root.render(<Popup />);
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Open pull request");
    });

    expect(container.querySelector(".status-banner--succeeded")).not.toBeNull();
    expect(container.textContent).not.toContain("jobs/acme/engineer");
  });

  it("does not render a result block for a successful run without a PR URL", async () => {
    localGet.mockResolvedValue({ activeRunId: "run-2" });
    apiRun = {
      runId: "run-2",
      status: "succeeded",
      outputPaths: {
        fitReport: "jobs/acme/engineer/fit-report.md",
        tailoredResume: "jobs/acme/engineer/tailored-resume.md",
        changeSummary: "jobs/acme/engineer/change-summary.md",
      },
    };

    await act(async () => {
      root.render(<Popup />);
    });

    await waitFor(() => {
      expect(container.querySelector(".status-banner--succeeded")).not.toBeNull();
    });

    expect(container.querySelector("[aria-label='Run result']")).toBeNull();
    expect(container.textContent).not.toContain("jobs/acme/engineer");
  });

  it("keeps failed run errors visible", async () => {
    localGet.mockResolvedValue({ activeRunId: "run-3" });
    apiRun = {
      runId: "run-3",
      status: "failed",
      error: "Agent run failed",
      outputPaths: {
        fitReport: "jobs/acme/engineer/fit-report.md",
        tailoredResume: "jobs/acme/engineer/tailored-resume.md",
        changeSummary: "jobs/acme/engineer/change-summary.md",
      },
    };

    await act(async () => {
      root.render(<Popup />);
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Agent run failed");
    });

    expect(container.querySelector(".status-banner--failed")).not.toBeNull();
  });

  it("renders title, company, and url in paste mode and prefills active tab url", async () => {
    (chrome.tabs.query as any) = vi.fn((_query: any, callback?: any) => {
      callback?.([{ id: 1, url: "https://example.com/job/99", title: "Active Tab Title" }]);
      return Promise.resolve([{ id: 1, url: "https://example.com/job/99", title: "Active Tab Title" }]);
    });

    await act(async () => {
      root.render(<Popup />);
    });

    await waitFor(() => {
      expect(container.querySelector("nav.segmented")).not.toBeNull();
    });

    const pasteTabBtn = container.querySelector("nav.segmented button:nth-child(2)") as HTMLButtonElement;
    await act(async () => {
      pasteTabBtn.click();
    });

    await waitFor(() => {
      expect(container.querySelector("#jd-url")).not.toBeNull();
    });

    const urlInput = container.querySelector("#jd-url") as HTMLInputElement;
    const titleInput = container.querySelector("#jd-title") as HTMLInputElement;
    const companyInput = container.querySelector("#jd-company") as HTMLInputElement;
    const descTextarea = container.querySelector("#jd-paste") as HTMLTextAreaElement;

    expect(urlInput).not.toBeNull();
    expect(urlInput.value).toBe("https://example.com/job/99");
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe("Active Tab Title");
    expect(companyInput).not.toBeNull();
    expect(descTextarea).not.toBeNull();
  });
});
