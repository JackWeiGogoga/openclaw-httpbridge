import type {
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelOutboundPayloadContext,
  OutboundDeliveryResult,
} from "openclaw/plugin-sdk";
import { missingTargetError } from "openclaw/plugin-sdk";

import { resolveHttpBridgeAccount } from "./accounts.js";
import { resolveCallbackUrl } from "./callbacks.js";

function ensureTarget(to: string | undefined): string {
  const trimmed = to?.trim();
  if (trimmed) return trimmed;
  throw missingTargetError("HTTP Bridge", "conversationId");
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

export const httpbridgeOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  resolveTarget: ({ to }) => {
    const resolved = ensureTarget(to);
    return { ok: true, to: resolved };
  },
  sendText: async (ctx: ChannelOutboundContext): Promise<OutboundDeliveryResult> => {
    const account = resolveHttpBridgeAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
    const conversationId = ensureTarget(ctx.to);
    const callbackUrl = resolveCallbackUrl({ conversationId, account });
    if (!callbackUrl) {
      throw new Error("callbackUrl is required (or set channels.httpbridge.callbackDefault)");
    }
    const messageId = `httpbridge-${Date.now()}`;
    await postCallback(callbackUrl, {
      conversationId,
      messageId,
      text: ctx.text,
      mediaUrls: [],
      sessionKey: ctx.sessionKey ?? conversationId,
      agentId: ctx.agentId ?? "main",
      timestamp: Date.now(),
    });
    return {
      channel: "httpbridge",
      messageId,
      chatId: conversationId,
      timestamp: Date.now(),
      to: conversationId,
    };
  },
  sendPayload: async (ctx: ChannelOutboundPayloadContext): Promise<OutboundDeliveryResult> => {
    const account = resolveHttpBridgeAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
    const conversationId = ensureTarget(ctx.to);
    const callbackUrl = resolveCallbackUrl({ conversationId, account });
    if (!callbackUrl) {
      throw new Error("callbackUrl is required (or set channels.httpbridge.callbackDefault)");
    }
    const messageId = `httpbridge-${Date.now()}`;
    const mediaUrls = ctx.payload.mediaUrls?.length
      ? ctx.payload.mediaUrls
      : ctx.payload.mediaUrl
        ? [ctx.payload.mediaUrl]
        : [];
    await postCallback(callbackUrl, {
      conversationId,
      messageId,
      text: ctx.payload.text,
      mediaUrls,
      sessionKey: ctx.sessionKey ?? conversationId,
      agentId: ctx.agentId ?? "main",
      timestamp: Date.now(),
    });
    return {
      channel: "httpbridge",
      messageId,
      chatId: conversationId,
      timestamp: Date.now(),
      to: conversationId,
    };
  },
};
