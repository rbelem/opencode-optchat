import type { MemoryStatus } from "./settings-status.ts";
export interface StatusIndicator {
    text: string;
    tone: "muted" | "success" | "warning" | "error";
}
export declare function statusIndicator(status: MemoryStatus, columns?: number): StatusIndicator;
export declare function activityDetails(status: MemoryStatus): string;
export declare function createStatusReader<Location>(options: {
    location: () => Location | undefined;
    read: (location: Location, signal: AbortSignal) => Promise<MemoryStatus>;
    update: (indicator: StatusIndicator, status?: MemoryStatus) => void;
    columns?: () => number | undefined;
}): {
    refresh(): Promise<void>;
    dispose(): void;
};
