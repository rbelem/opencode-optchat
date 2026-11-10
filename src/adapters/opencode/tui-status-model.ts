import type { MemoryStatus } from "./settings-status.ts";

export interface StatusIndicator {
  text: string;
  tone: "muted" | "success" | "warning" | "error";
}

export function statusIndicator(status: MemoryStatus, columns?: number): StatusIndicator {
  const narrow = columns !== undefined && columns < 80;
  const minimal = columns !== undefined && columns < 44;
  const indicator = baseIndicator(status, narrow);
  if (status.totalMessages !== undefined && status.processedMessages !== undefined && status.enabled) {
    const mode = status.nativeTurns ? "N" : "M";
    const state = status.jobs.failed || status.jobs.expired ? "!" : status.lastError === "BACKGROUND_PAUSED" ? "P" : "";
    const jobs = status.jobs.pending + status.jobs.running + status.jobs.failed;
    const unknown = status.inventoryComplete ? "" : "?";
    if (minimal) {
      const jobsPart = jobs > 0 ? ` ${jobs}j` : "";
      const retryPart = status.retryInSeconds === undefined ? "" : ` r${status.retryInSeconds}s`;
      return { text: `OC:${mode}${state}${jobsPart}${retryPart}`, tone: indicator.tone };
    }
    if (narrow) {
      const jobsPart = jobs > 0 ? `·${jobs}j` : "";
      const retry = status.retryInSeconds === undefined ? "" : ` r${status.retryInSeconds}s`;
      return { text: `OC:${mode}${state} ${status.processedMessages}/${status.totalMessages}${unknown}${jobsPart}${retry}`, tone: indicator.tone };
    }
    const retry = status.retryInSeconds === undefined ? "" : ` · r${status.retryInSeconds}s`;
    return { text: `OC:${mode}${state} ${status.processedMessages}/${status.totalMessages}${unknown}m · ${jobs}j${retry}`, tone: indicator.tone };
  }
  if (!status.enabled || status.remainingMessages === undefined) return indicator;
  const jobs = status.jobs.pending + status.jobs.running + status.jobs.failed;
  if (status.remainingMessages || jobs) indicator.text += narrow ? ` · ${status.remainingMessages} left · ${jobs}j` : ` · ${status.remainingMessages} msgs left · ${jobs} jobs`;
  return indicator;
}

export function activityDetails(status: MemoryStatus): string {
  const total = status.totalMessages ?? 0, done = status.processedMessages ?? 0;
  const ratio = total ? Math.min(1, Math.max(0, done / total)) : 0;
  const filled = Math.floor(ratio * 12);
  const jobs = status.jobs.pending + status.jobs.running + status.jobs.failed;
  const state = !status.enabled ? "Disabled" : status.lastError === "BACKGROUND_PAUSED" ? "Paused"
    : status.jobs.failed || status.jobs.expired ? "Blocked" : jobs || done < total || !status.inventoryComplete ? "Preparing" : "Settled";
  return `${state}\nMessages: [${"#".repeat(filled)}${"-".repeat(12 - filled)}] ${done}/${total}${status.inventoryComplete ? "" : " (inventory incomplete)"}\nJobs: ${jobs} unfinished, ${status.jobs.done} completed\nJob error: ${status.jobError ?? "none"}\nProvider retry: ${status.retryInSeconds === undefined ? "none scheduled" : `${status.retryInSeconds}s (retry ${status.retryAttempt ?? 0}/3)`}\nCounts cover retained history. New history and derived jobs can increase totals.`;
}

function baseIndicator(status: MemoryStatus, narrow = false): StatusIndicator {
  const prefix = narrow ? "OC:" : "OptChat:";
  if (!status.enabled) return { text: `${prefix} off`, tone: "muted" };
  if (status.nativeTurns) {
    const preparation = status.jobs.failed ? "failed" : status.jobs.running ? `preparing ${status.jobs.running}`
      : status.jobs.pending && status.lastError === "BACKGROUND_PAUSED" ? "paused" : status.jobs.pending ? `queued ${status.jobs.pending}` : "";
    return { text: `${prefix} native${preparation ? ` · ${preparation}` : ""}`, tone: "warning" };
  }
  if (status.jobs.failed || status.jobs.expired) return { text: `${prefix} error`, tone: "error" };
  if (status.jobs.running) return { text: `${prefix} processing ${status.jobs.running}`, tone: "warning" };
  if (status.jobs.pending && status.lastError === "BACKGROUND_PAUSED") return { text: `${prefix} paused`, tone: "warning" };
  if (status.jobs.pending) return { text: `${prefix} queued ${status.jobs.pending}`, tone: "warning" };
  if (status.activeTurns) return { text: `${prefix} active`, tone: "success" };
  return { text: `${prefix} ready`, tone: "success" };
}

export function createStatusReader<Location>(options: {
  location: () => Location | undefined;
  read: (location: Location, signal: AbortSignal) => Promise<MemoryStatus>;
  update: (indicator: StatusIndicator, status?: MemoryStatus) => void;
  columns?: () => number | undefined;
}) {
  let disposed = false;
  let pending = false;
  let controller: AbortController | undefined;
  return {
    async refresh() {
      if (disposed || pending) return;
      const location = options.location();
      if (!location) {
        options.update({ text: "OptChat: unavailable", tone: "muted" });
        return;
      }
      const key = JSON.stringify(location);
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 4000);
      try {
        const status = await options.read(location, controller.signal);
        if (!disposed && key === JSON.stringify(options.location())) options.update(statusIndicator(status, options.columns?.()), status);
      } catch {
        if (!disposed && key === JSON.stringify(options.location())) {
          options.update({ text: "OptChat: unavailable", tone: "muted" });
        }
      } finally {
        clearTimeout(timeout);
        pending = false;
      }
    },
    dispose() {
      disposed = true;
      controller?.abort();
    },
  };
}
