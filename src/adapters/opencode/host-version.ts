import { insist } from "../../core/types.ts";

// The adapter supports the OpenCode 2.0.x, 2.1.x, 2.2.x, and 2.3.x plugin contracts.
// The native build reports 0.0.0-native-<build> and carries the same V2 plugin contract.
// A newer minor can change plugin payloads, so the adapter rejects it.
const supportedHost = /^2\.(?:0|1|2|3)\.\d+$|^0\.0\.0-native-\d+$/;

export function insistSupportedHost(version: string): void {
  insist(supportedHost.test(version), "UNSUPPORTED_HOST", "OptChat supports the OpenCode 2.0.x, 2.1.x, 2.2.x, 2.3.x, and 0.0.0-native plugin contracts only");
}
