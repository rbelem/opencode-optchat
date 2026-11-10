import type { Context } from "@opencode/plugin/tui/plugin";
import { createElement, spread, useTerminalDimensions } from "@opentui/solid";
import { createSignal, onCleanup, onMount } from "solid-js";
import { SettingsRpc } from "./settings-rpc.ts";
import type { MemoryStatus } from "./settings-status.ts";
import { createStatusReader, statusIndicator, type StatusIndicator } from "./tui-status-model.ts";

export function registerStatusBar(ctx: Context): () => void {
  const rpc = ctx.client.rpc(SettingsRpc);
  const cleanups = new Set<() => void>();
  const render = () => {
    const dimensions = useTerminalDimensions();
    const checking: StatusIndicator = { text: "OptChat: checking", tone: "muted" };
    const [snapshot, setSnapshot] = createSignal<{ indicator: StatusIndicator; status?: MemoryStatus }>({ indicator: checking });
    const shown = () => {
      const entry = snapshot();
      return entry.status ? statusIndicator(entry.status, dimensions().width) : entry.indicator;
    };
    const reader = createStatusReader({
      location: () => ctx.location ?? ctx.data.location.default(),
      read: async (location, signal) => await rpc.status({}, { location, signal }) as MemoryStatus,
      update: (indicator, status) => setSnapshot({ indicator, status }),
      columns: () => dimensions().width,
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      clearInterval(timer);
      reader.dispose();
      cleanups.delete(cleanup);
    };
    cleanups.add(cleanup);
    onMount(() => {
      void reader.refresh();
      timer = setInterval(() => void reader.refresh(), 5000);
    });
    onCleanup(cleanup);
    const text = createElement("text");
    spread(text, {
      flexShrink: 1,
      wrapMode: "none",
      truncate: true,
      get fg() {
        const theme = ctx.theme;
        const tone = shown().tone;
        return tone === "muted" ? theme.text.muted : theme.text.feedback[tone].base;
      },
      get children() { return ` ${shown().text} `; },
    });
    // The pinned slot API uses Solid's generic element type for terminal renderables.
    return text as unknown as import("solid-js").JSX.Element;
  };
  const removeHome = ctx.ui.slot({ append: "home.footer.status", render });
  let removePrompt: () => void;
  try {
    removePrompt = ctx.ui.slot({ append: "prompt.footer.status", render });
  } catch (error) {
    removeHome();
    throw error;
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
    removePrompt();
    removeHome();
  };
}
