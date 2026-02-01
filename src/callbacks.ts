import type { ResolvedHttpBridgeAccount } from "./types.js";

export type CallbackEntry = {
  url: string;
  accountId: string;
  updatedAt: number;
};

const callbacks = new Map<string, CallbackEntry>();

const DEFAULT_TTL_MINUTES = 24 * 60;
const DEFAULT_MAX_ENTRIES = 10_000;

function normalizeConversationId(conversationId: string): string {
  return conversationId.trim();
}

function resolveTtlMinutes(account: ResolvedHttpBridgeAccount): number {
  const value = account.config.callbackTtlMinutes;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return DEFAULT_TTL_MINUTES;
}

function resolveMaxEntries(account: ResolvedHttpBridgeAccount): number {
  const value = account.config.maxCallbackEntries;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return DEFAULT_MAX_ENTRIES;
}

function pruneExpired(now: number, ttlMinutes: number) {
  const cutoff = now - ttlMinutes * 60 * 1000;
  for (const [key, entry] of callbacks.entries()) {
    if (entry.updatedAt < cutoff) {
      callbacks.delete(key);
    }
  }
}

function pruneOverflow(maxEntries: number) {
  if (callbacks.size <= maxEntries) return;
  const entries = Array.from(callbacks.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const toRemove = entries.length - maxEntries;
  for (let i = 0; i < toRemove; i += 1) {
    callbacks.delete(entries[i]?.[0]);
  }
}

export function rememberCallback(params: {
  conversationId: string;
  callbackUrl: string;
  account: ResolvedHttpBridgeAccount;
}) {
  const conversationId = normalizeConversationId(params.conversationId);
  const now = Date.now();
  callbacks.set(conversationId, {
    url: params.callbackUrl,
    accountId: params.account.accountId,
    updatedAt: now,
  });
  pruneExpired(now, resolveTtlMinutes(params.account));
  pruneOverflow(resolveMaxEntries(params.account));
}

export function resolveCallbackUrl(params: {
  conversationId: string;
  account: ResolvedHttpBridgeAccount;
}): string | undefined {
  const key = normalizeConversationId(params.conversationId);
  const now = Date.now();
  pruneExpired(now, resolveTtlMinutes(params.account));
  const entry = callbacks.get(key);
  if (!entry) return params.account.config.callbackDefault;
  entry.updatedAt = now;
  return entry.url;
}
