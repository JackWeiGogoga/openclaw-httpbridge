# OpenClaw HTTP Bridge

HTTP inbound + callback outbound channel plugin for OpenClaw. Send messages to OpenClaw over HTTP, receive every reply via your `callbackUrl`.

## Features

- HTTP webhook ingress (`/httpbridge/inbound`)
- Per-conversation callback routing
- Token-based inbound auth
- Optional callback host allowlist
- Compatible with OpenClaw channel routing/session behavior

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

Add to your OpenClaw config:

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

Notes:
- `token` is required for inbound auth.
- `callbackDefault` is used when the request does not include `callbackUrl`.
- `allowCallbackHosts` is an optional safety allowlist for callback hostnames.

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

## License

MIT
