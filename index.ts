import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { httpbridgePlugin } from "./src/channel.js";
import { handleHttpBridgeWebhookRequest } from "./src/monitor.js";
import { setHttpBridgeRuntime } from "./src/runtime.js";

const plugin = {
  id: "openclaw-httpbridge",
  name: "HTTP Bridge",
  description: "HTTP inbound + callback outbound channel for OpenClaw",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setHttpBridgeRuntime(api.runtime);
    api.registerChannel({ plugin: httpbridgePlugin });
    api.registerHttpHandler(handleHttpBridgeWebhookRequest);
  },
};

export default plugin;
