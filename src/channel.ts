import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import {
  applyAccountNameToChannelSection,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
} from "openclaw/plugin-sdk";

import {
  resolveHttpBridgeAccount,
  listHttpBridgeAccountIds,
  resolveDefaultHttpBridgeAccountId,
} from "./accounts.js";
import { httpbridgeOnboardingAdapter } from "./onboarding.js";
import { httpbridgeOutbound } from "./outbound.js";
import { resolveHttpBridgeWebhookPath, startHttpBridgeMonitor } from "./monitor.js";
import type { ResolvedHttpBridgeAccount } from "./types.js";

const meta = {
  id: "httpbridge",
  label: "HTTP Bridge",
  selectionLabel: "HTTP Bridge (Webhook + Callback)",
  detailLabel: "HTTP Bridge",
  docsPath: "/channels/httpbridge",
  docsLabel: "httpbridge",
  blurb: "Custom HTTP ingress with callback delivery.",
  aliases: ["http-bridge", "webhook-bridge"],
  order: 90,
} as const;

function normalizeTarget(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

const HttpBridgeChannelSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    token: { type: "string" },
    webhookPath: { type: "string" },
    callbackDefault: { type: "string" },
    allowCallbackHosts: { type: "array", items: { type: "string" } },
    callbackTtlMinutes: { type: "number" },
    maxCallbackEntries: { type: "number" },
    defaultAccount: { type: "string" },
    accounts: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          token: { type: "string" },
          webhookPath: { type: "string" },
          callbackDefault: { type: "string" },
          allowCallbackHosts: { type: "array", items: { type: "string" } },
          callbackTtlMinutes: { type: "number" },
          maxCallbackEntries: { type: "number" },
        },
      },
    },
  },
};

export const httpbridgePlugin: ChannelPlugin<ResolvedHttpBridgeAccount> = {
  id: "httpbridge",
  meta,
  onboarding: httpbridgeOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct"],
    media: true,
    threads: false,
  },
  reload: { configPrefixes: ["channels.httpbridge"] },
  configSchema: { schema: HttpBridgeChannelSchema },
  config: {
    listAccountIds: (cfg) => listHttpBridgeAccountIds(cfg as OpenClawConfig),
    resolveAccount: (cfg, accountId) =>
      resolveHttpBridgeAccount({ cfg: cfg as OpenClawConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultHttpBridgeAccountId(cfg as OpenClawConfig),
    isConfigured: (account) => Boolean(account.config.token || account.config.callbackDefault),
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      webhookPath: resolveHttpBridgeWebhookPath(account),
    }),
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "httpbridge",
        accountId,
        name,
      }),
    validateInput: ({ input }) => {
      if (!input.token) {
        return "HTTP Bridge requires --token for inbound auth.";
      }
      if (!input.url && !input.webhookUrl) {
        return "HTTP Bridge requires --url (callbackDefault).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "httpbridge",
        accountId,
        name: input.name,
      });
      const webhookPath = input.webhookPath?.trim();
      const callbackDefault = (input.url ?? input.webhookUrl ?? "").trim();
      const configPatch = {
        ...(input.token ? { token: input.token } : {}),
        ...(webhookPath ? { webhookPath } : {}),
        ...(callbackDefault ? { callbackDefault } : {}),
      };
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...namedConfig,
          channels: {
            ...namedConfig.channels,
            httpbridge: {
              ...namedConfig.channels?.httpbridge,
              enabled: true,
              ...configPatch,
            },
          },
        } as OpenClawConfig;
      }
      return {
        ...namedConfig,
        channels: {
          ...namedConfig.channels,
          httpbridge: {
            ...namedConfig.channels?.httpbridge,
            enabled: true,
            accounts: {
              ...namedConfig.channels?.httpbridge?.accounts,
              [accountId]: {
                ...namedConfig.channels?.httpbridge?.accounts?.[accountId],
                enabled: true,
                ...configPatch,
              },
            },
          },
        },
      } as OpenClawConfig;
    },
  },
  outbound: httpbridgeOutbound,
  messaging: {
    normalizeTarget: (raw) => normalizeTarget(raw),
    targetResolver: {
      looksLikeId: (raw) => Boolean(raw.trim()),
      hint: "conversationId",
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      webhookPath: resolveHttpBridgeWebhookPath(account),
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.log?.info(`[${account.accountId}] starting HTTP Bridge webhook`);
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
        webhookPath: resolveHttpBridgeWebhookPath(account),
      });
      const unregister = await startHttpBridgeMonitor({
        account,
        config: ctx.cfg as OpenClawConfig,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        webhookPath: account.config.webhookPath,
        statusSink: (patch) => ctx.setStatus({ accountId: account.accountId, ...patch }),
      });
      return () => {
        unregister?.();
        ctx.setStatus({
          accountId: account.accountId,
          running: false,
          lastStopAt: Date.now(),
        });
      };
    },
  },
};
