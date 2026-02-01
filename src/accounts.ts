import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";

import type { HttpBridgeAccountConfig, HttpBridgeConfig, ResolvedHttpBridgeAccount } from "./types.js";

const DEFAULT_WEBHOOK_PATH = "/httpbridge/inbound";

function resolveConfig(cfg: OpenClawConfig): HttpBridgeConfig {
  return (cfg.channels?.httpbridge ?? {}) as HttpBridgeConfig;
}

function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): { account: HttpBridgeAccountConfig; base: HttpBridgeConfig } {
  const base = resolveConfig(cfg);
  const account = (base.accounts?.[accountId] ?? {}) as HttpBridgeAccountConfig;
  return { account, base };
}

export function listHttpBridgeAccountIds(cfg: OpenClawConfig): string[] {
  const base = resolveConfig(cfg);
  const ids = Object.keys(base.accounts ?? {});
  return ids.length > 0 ? ids : [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultHttpBridgeAccountId(cfg: OpenClawConfig): string {
  const base = resolveConfig(cfg);
  const preferred = base.defaultAccount?.trim();
  if (preferred) return preferred;
  return DEFAULT_ACCOUNT_ID;
}

export function resolveHttpBridgeAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedHttpBridgeAccount {
  const accountId = (params.accountId ?? resolveDefaultHttpBridgeAccountId(params.cfg)).trim();
  const { account, base } = resolveAccountConfig(params.cfg, accountId);
  const enabledBase = base.enabled !== false;
  const enabled = enabledBase && account.enabled !== false;
  const webhookPath = account.webhookPath?.trim() || base.webhookPath?.trim() || DEFAULT_WEBHOOK_PATH;
  const token = account.token ?? base.token;
  const callbackDefault = account.callbackDefault ?? base.callbackDefault;
  const allowCallbackHosts = account.allowCallbackHosts ?? base.allowCallbackHosts;
  const callbackTtlMinutes = account.callbackTtlMinutes ?? base.callbackTtlMinutes;
  const maxCallbackEntries = account.maxCallbackEntries ?? base.maxCallbackEntries;

  return {
    accountId,
    name: base.defaultAccount === accountId ? "default" : accountId,
    enabled,
    configured: Boolean(token || callbackDefault),
    config: {
      webhookPath,
      token,
      callbackDefault,
      allowCallbackHosts,
      callbackTtlMinutes,
      maxCallbackEntries,
      enabled,
    },
  };
}
