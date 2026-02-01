# OpenClaw HTTP Bridge

HTTP inbound + callback outbound channel plugin for OpenClaw. Send messages to OpenClaw over HTTP, receive every reply via your `callbackUrl`.

## Features

- HTTP webhook ingress (`/httpbridge/inbound`)
- Per-conversation callback routing
- Token-based inbound auth
- Optional callback host allowlist
- Compatible with OpenClaw channel routing/session behavior
- Supports `openclaw channels add` and onboarding wizard

## Requirements

- OpenClaw >= 2026.1.26
- Node.js 22+

## Install

### Local path

```bash
openclaw plugins install /path/to/openclaw-httpbridge
openclaw plugins enable openclaw-httpbridge
```

### npm (after publish)

```bash
openclaw plugins install openclaw-httpbridge
openclaw plugins enable openclaw-httpbridge
```

## Configuration

### Option A: `openclaw channels add` (recommended for CLI)

```bash
openclaw channels add --channel httpbridge \
  --token shared-secret \
  --webhook-path /httpbridge/inbound \
  --url http://127.0.0.1:9011/callback
```

This writes config under `channels.httpbridge` and enables the channel.

### Option B: Onboarding wizard

```bash
openclaw channels add --channel httpbridge
```

The wizard prompts for:
- token
- webhookPath
- callbackDefault
- allowCallbackHosts (optional)

### Option C: Manual config (JSON)

```json
{
  "channels": {
    "httpbridge": {
      "enabled": true,
      "token": "shared-secret",
      "webhookPath": "/httpbridge/inbound",
      "callbackDefault": "http://127.0.0.1:9011/callback",
      "allowCallbackHosts": ["127.0.0.1"]
    }
  }
}
```

## Usage

### Inbound request

```bash
curl -X POST http://127.0.0.1:18789/httpbridge/inbound \
  -H 'Authorization: Bearer shared-secret' \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"demo-123","text":"Hello OpenClaw","callbackUrl":"http://127.0.0.1:9011/callback"}'
```

### Inbound payload

```json
{
  "conversationId": "demo-123",
  "text": "Hello OpenClaw",
  "callbackUrl": "http://127.0.0.1:9011/callback",
  "senderId": "user-42",
  "senderName": "Alice",
  "metadata": {"source": "demo"}
}
```

### Callback payload

```json
{
  "conversationId": "demo-123",
  "messageId": "httpbridge-1730000000000",
  "text": "OpenClaw reply text",
  "mediaUrls": [],
  "sessionKey": "httpbridge:demo-123",
  "agentId": "main",
  "timestamp": 1730000000000
}
```

## Security

- Keep the webhook behind a trusted network or proxy.
- Use a strong `token`.
- Restrict `allowCallbackHosts` when possible.

## Development

- Code entry: `index.ts`
- Channel implementation: `src/channel.ts`
- Webhook handler: `src/monitor.ts`
- Onboarding adapter: `src/onboarding.ts`

## License

MIT
