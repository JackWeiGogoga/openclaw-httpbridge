# HTTP Bridge Demo

This demo shows:
1) starting a callback receiver
2) sending a webhook into OpenClaw
3) observing the callback response

## 1) Start the callback server

From the plugin directory:

```bash
python3 demo-callback-server.py
```

Expected output:

```
Callback server listening on http://127.0.0.1:9011/callback
```

## 2) Configure OpenClaw

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

Restart the gateway after config changes.

## 3) Send a test inbound request

```bash
curl -X POST http://127.0.0.1:18789/httpbridge/inbound \
  -H 'Authorization: Bearer shared-secret' \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"demo-123","text":"Hello OpenClaw","callbackUrl":"http://127.0.0.1:9011/callback"}'
```

Expected response:

```
accepted
```

## 4) Observe callback output

The Python server will log the callback payload:

```
=== Callback Received ===
Path: /callback
Headers: {...}
Body: {"conversationId":"demo-123","messageId":"httpbridge-...","text":"...","sessionKey":"httpbridge:demo-123","agentId":"main","timestamp":...}
```

If you don’t pass `callbackUrl` in the inbound payload, the plugin uses `callbackDefault`.
