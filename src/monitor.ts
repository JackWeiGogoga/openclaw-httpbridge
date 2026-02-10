import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

import { resolveHttpBridgeAccount } from "./accounts.js";
import { rememberCallback, resolveCallbackUrl } from "./callbacks.js";
import { getHttpBridgeRuntime } from "./runtime.js";
import type { HttpBridgeInboundPayload, ResolvedHttpBridgeAccount } from "./types.js";

const DEFAULT_WEBHOOK_PATH = "/httpbridge/inbound";
const MAX_BODY_BYTES = 1024 * 1024;

export type HttpBridgeRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

type WebhookTarget = {
  account: ResolvedHttpBridgeAccount;
  config: OpenClawConfig;
  runtime: HttpBridgeRuntimeEnv;
  path: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

const webhookTargets = new Map<string, WebhookTarget[]>();

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

export function resolveHttpBridgeWebhookPath(account: ResolvedHttpBridgeAccount): string {
  return normalizeWebhookPath(account.config.webhookPath || DEFAULT_WEBHOOK_PATH);
}

export function registerHttpBridgeWebhookTarget(target: WebhookTarget): () => void {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);
  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter((entry) => entry !== normalizedTarget);
    if (updated.length > 0) {
      webhookTargets.set(key, updated);
    } else {
      webhookTargets.delete(key);
    }
  };
}

async function readJsonBody(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise<{ ok: boolean; value?: unknown; error?: string }>((resolve) => {
    let resolved = false;
    const doResolve = (value: { ok: boolean; value?: unknown; error?: string }) => {
      if (resolved) return;
      resolved = true;
      req.removeAllListeners();
      resolve(value);
    };
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        doResolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          doResolve({ ok: false, error: "empty payload" });
          return;
        }
        doResolve({ ok: true, value: JSON.parse(raw) as unknown });
      } catch (err) {
        doResolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
    req.on("error", (err) => {
      doResolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
  });
}

function extractBearerToken(req: IncomingMessage): string {
  const authHeader = String(req.headers.authorization ?? "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim();
  }
  const alt = String(req.headers["x-openclaw-token"] ?? "");
  return alt.trim();
}

function pickTarget(targets: WebhookTarget[], payload: HttpBridgeInboundPayload): WebhookTarget {
  const accountId = payload.accountId?.trim();
  if (accountId) {
    const match = targets.find((entry) => entry.account.accountId === accountId);
    if (match) return match;
  }
  return targets[0]!;
}

function buildConversationSessionKey(params: {
  agentId: string;
  accountId: string;
  conversationId: string;
}): string {
  const agentId = params.agentId.trim().toLowerCase();
  const accountId = params.accountId.trim().toLowerCase();
  const conversationId = params.conversationId.trim().toLowerCase();
  return `agent:${agentId}:httpbridge:${accountId}:dm:${conversationId}`;
}

function validateCallbackUrl(url: string, account: ResolvedHttpBridgeAccount) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("callbackUrl must be a valid URL");
  }
  if (!parsed.protocol || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error("callbackUrl must use http or https");
  }
  const allowlist = account.config.allowCallbackHosts;
  if (Array.isArray(allowlist) && allowlist.length > 0) {
    const host = parsed.hostname.toLowerCase();
    const allowed = allowlist.some((entry) => entry.trim().toLowerCase() === host);
    if (!allowed) {
      throw new Error("callbackUrl host not allowed");
    }
  }
}

async function postCallback(url: string, payload: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`callback failed (${res.status})`);
  }
}

export async function handleHttpBridgeWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const targets = webhookTargets.get(path);
  if (!targets || targets.length === 0) return false;

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) {
    res.statusCode = body.error === "payload too large" ? 413 : 400;
    res.end(body.error ?? "invalid payload");
    return true;
  }

  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    res.statusCode = 400;
    res.end("invalid payload");
    return true;
  }

  const payload = body.value as HttpBridgeInboundPayload;
  const conversationId = payload.conversationId?.trim();
  if (!conversationId) {
    res.statusCode = 400;
    res.end("conversationId is required");
    return true;
  }

  const target = pickTarget(targets, payload);
  const account = target.account;

  const expectedToken = account.config.token?.trim();
  if (expectedToken) {
    const provided = extractBearerToken(req);
    if (!provided || provided !== expectedToken) {
      res.statusCode = 401;
      res.end("unauthorized");
      return true;
    }
  }

  const rawText = (payload.text ?? payload.message ?? "").trim();
  if (!rawText) {
    res.statusCode = 400;
    res.end("text is required");
    return true;
  }

  if (payload.callbackUrl?.trim()) {
    try {
      validateCallbackUrl(payload.callbackUrl, account);
      rememberCallback({
        conversationId,
        callbackUrl: payload.callbackUrl.trim(),
        account,
      });
    } catch (err) {
      res.statusCode = 400;
      res.end(err instanceof Error ? err.message : String(err));
      return true;
    }
  }

  const callbackUrl = resolveCallbackUrl({ conversationId, account });
  if (!callbackUrl) {
    res.statusCode = 400;
    res.end("callbackUrl is required (or set channels.httpbridge.callbackDefault)");
    return true;
  }

  const core = getHttpBridgeRuntime();
  const config = target.config;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "httpbridge",
    accountId: account.accountId,
    peer: {
      kind: "dm",
      id: conversationId,
    },
  });
  const sessionKey = buildConversationSessionKey({
    agentId: route.agentId,
    accountId: route.accountId,
    conversationId,
  });

  const fromLabel = payload.senderName?.trim() || payload.senderId?.trim() || `conv:${conversationId}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey,
  });
  const bodyText = core.channel.reply.formatAgentEnvelope({
    channel: "HTTP Bridge",
    from: fromLabel,
    timestamp: Date.now(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawText,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: bodyText,
    RawBody: rawText,
    CommandBody: rawText,
    From: payload.senderId ? `httpbridge:${payload.senderId}` : `httpbridge:conv:${conversationId}`,
    To: `httpbridge:${conversationId}`,
    SessionKey: sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: fromLabel,
    SenderName: payload.senderName?.trim() || undefined,
    SenderId: payload.senderId?.trim() || undefined,
    Provider: "httpbridge",
    Surface: "httpbridge",
    OriginatingChannel: "httpbridge",
    OriginatingTo: `httpbridge:${conversationId}`,
  });

  void core.channel.session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? sessionKey,
      ctx: ctxPayload,
    })
    .catch((err) => {
      target.runtime.error?.(`httpbridge: failed updating session meta: ${String(err)}`);
    });

  target.statusSink?.({ lastInboundAt: Date.now() });

  void core.channel.reply
    .dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        deliver: async (payload) => {
          try {
            const messageId = payload.messageId ?? `httpbridge-${Date.now()}`;
            await postCallback(callbackUrl, {
              conversationId,
              messageId,
              text: payload.text,
              mediaUrls: payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : undefined),
              sessionKey,
              agentId: route.agentId,
              timestamp: Date.now(),
            });
            target.statusSink?.({ lastOutboundAt: Date.now() });
          } catch (err) {
            target.runtime.error?.(`httpbridge: callback failed: ${String(err)}`);
          }
        },
        onError: (err, info) => {
          target.runtime.error?.(`httpbridge ${info.kind} reply failed: ${String(err)}`);
        },
      },
    })
    .catch((err) => {
      target.runtime.error?.(`httpbridge: dispatch failed: ${String(err)}`);
    });

  res.statusCode = 202;
  res.end("accepted");
  return true;
}

export async function startHttpBridgeMonitor(params: {
  account: ResolvedHttpBridgeAccount;
  config: OpenClawConfig;
  runtime: HttpBridgeRuntimeEnv;
  abortSignal: AbortSignal;
  webhookPath?: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<() => void> {
  const path = params.webhookPath?.trim() || params.account.config.webhookPath || DEFAULT_WEBHOOK_PATH;
  return registerHttpBridgeWebhookTarget({
    account: params.account,
    config: params.config,
    runtime: params.runtime,
    path,
    statusSink: params.statusSink,
  });
}
