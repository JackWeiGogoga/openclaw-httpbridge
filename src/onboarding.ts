import type { OpenClawConfig } from "openclaw/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  promptAccountId,
  type ChannelOnboardingAdapter,
  type WizardPrompter,
} from "openclaw/plugin-sdk";

import {
  listHttpBridgeAccountIds,
  resolveDefaultHttpBridgeAccountId,
  resolveHttpBridgeAccount,
} from "./accounts.js";

const channel = "httpbridge" as const;

function applyAccountConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  patch: Record<string, unknown>;
}): OpenClawConfig {
  const { cfg, accountId, patch } = params;
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        httpbridge: {
          ...cfg.channels?.httpbridge,
          enabled: true,
          ...patch,
        },
      },
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      httpbridge: {
        ...cfg.channels?.httpbridge,
        enabled: true,
        accounts: {
          ...cfg.channels?.httpbridge?.accounts,
          [accountId]: {
            ...cfg.channels?.httpbridge?.accounts?.[accountId],
            enabled: true,
            ...patch,
          },
        },
      },
    },
  };
}

function parseHosts(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function promptToken(prompter: WizardPrompter, current?: string) {
  const token = await prompter.text({
    message: "HTTP Bridge token (used for inbound auth)",
    placeholder: "shared-secret",
    initialValue: current || undefined,
    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
  });
  return String(token).trim();
}

async function promptWebhookPath(prompter: WizardPrompter, current?: string) {
  const path = await prompter.text({
    message: "Webhook path",
    placeholder: "/httpbridge/inbound",
    initialValue: current || "/httpbridge/inbound",
    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
  });
  const trimmed = String(path).trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

async function promptCallbackDefault(prompter: WizardPrompter, current?: string) {
  const url = await prompter.text({
    message: "Default callback URL",
    placeholder: "https://your.service/callback",
    initialValue: current || undefined,
    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
  });
  return String(url).trim();
}

async function promptAllowCallbackHosts(prompter: WizardPrompter, current?: string[]) {
  const existing = current?.length ? current.join(", ") : "";
  const raw = await prompter.text({
    message: "Callback host allowlist (comma or newline separated, optional)",
    placeholder: "example.com, api.example.com",
    initialValue: existing || undefined,
  });
  const hosts = parseHosts(String(raw ?? ""));
  return hosts.length > 0 ? hosts : undefined;
}

export const httpbridgeOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listHttpBridgeAccountIds(cfg).some((accountId) => {
      const account = resolveHttpBridgeAccount({ cfg, accountId });
      return Boolean(account.config.token || account.config.callbackDefault);
    });
    return {
      channel,
      configured,
      statusLines: [
        `HTTP Bridge: ${configured ? "configured" : "needs token + callback"}`,
      ],
      selectionHint: configured ? "configured" : "needs setup",
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const override = accountOverrides[channel]?.trim();
    const defaultAccountId = resolveDefaultHttpBridgeAccountId(cfg);
    let accountId = override ? normalizeAccountId(override) : defaultAccountId;

    if (shouldPromptAccountIds && !override) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "HTTP Bridge",
        currentId: accountId,
        listAccountIds: listHttpBridgeAccountIds,
        defaultAccountId,
      });
    }

    const existing = resolveHttpBridgeAccount({ cfg, accountId });
    let next = cfg;

    const token = await promptToken(prompter, existing.config.token);
    const webhookPath = await promptWebhookPath(prompter, existing.config.webhookPath);
    const callbackDefault = await promptCallbackDefault(
      prompter,
      existing.config.callbackDefault,
    );
    const allowCallbackHosts = await promptAllowCallbackHosts(
      prompter,
      existing.config.allowCallbackHosts,
    );

    next = applyAccountConfig({
      cfg: next,
      accountId,
      patch: {
        token,
        webhookPath,
        callbackDefault,
        ...(allowCallbackHosts ? { allowCallbackHosts } : {}),
      },
    });

    return { cfg: next, accountId };
  },
};
