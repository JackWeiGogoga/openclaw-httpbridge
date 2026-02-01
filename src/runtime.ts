import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setHttpBridgeRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getHttpBridgeRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("HTTP Bridge runtime not initialized");
  }
  return runtime;
}
