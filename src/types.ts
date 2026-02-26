export type HttpBridgeInboundImage = {
  /** Public URL to download image from (http/https). */
  url?: string;
  /** Base64 payload (plain base64 or data URL). */
  base64?: string;
  /** Alias for base64 payload (for compatibility). */
  data?: string;
  /** Optional MIME hint (e.g., image/png). */
  mimeType?: string;
  /** Optional filename hint for storage. */
  fileName?: string;
};

export type HttpBridgeInboundPayload = {
  conversationId: string;
  text?: string;
  message?: string;
  senderId?: string;
  senderName?: string;
  callbackUrl?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
  /** Preferred inbound image field (supports multiple images). */
  images?: HttpBridgeInboundImage[];
  /** Alias for images. */
  attachments?: HttpBridgeInboundImage[];
  /** Convenience single-image URL field. */
  imageUrl?: string;
  /** Convenience multi-image URL field. */
  imageUrls?: string[];
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
  mediaMaxMb?: number;
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
