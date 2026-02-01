export type HttpBridgeInboundPayload = {
  conversationId: string;
  text?: string;
  message?: string;
  senderId?: string;
  senderName?: string;
  callbackUrl?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
};

export type HttpBridgeCallbackPayload = {
  conversationId: string;
  messageId: string;
  text?: string;
  mediaUrls?: string[];
  sessionKey: string;
  agentId: string;
  timestamp: number;
};

export type HttpBridgeAccountConfig = {
  enabled?: boolean;
  token?: string;
  webhookPath?: string;
  callbackDefault?: string;
  allowCallbackHosts?: string[];
  callbackTtlMinutes?: number;
  maxCallbackEntries?: number;
};

export type HttpBridgeConfig = HttpBridgeAccountConfig & {
  defaultAccount?: string;
  accounts?: Record<string, HttpBridgeAccountConfig>;
};

export type ResolvedHttpBridgeAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  config: Required<Pick<HttpBridgeAccountConfig, "webhookPath">> & HttpBridgeAccountConfig;
};
