# ADR-005: Server-Sent Events over WebSocket

**Status:** Accepted
**Date:** 2025-11-26
**Deciders:** Development Team
**Context:** Real-time streaming technology for agent debate output

---

## Context

The AI debate platform needs to stream agent responses in real-time to create an engaging user experience. Users should see each agent's argument appear word-by-word (typewriter effect) rather than waiting for complete responses.

### Requirements

1. **Unidirectional Communication:** Server pushes agent outputs to client (client doesn't send data mid-debate)
2. **Streaming:** Must support token-by-token LLM output streaming
3. **Event Types:** Need to distinguish between different message types:
   - Agent starts speaking
   - Token chunks
   - Agent finishes
   - Debate complete
4. **Simplicity:** Should be easy to implement and debug
5. **Cloudflare Workers Compatibility:** Must work on Workers runtime

---

## Options Considered

### Option 1: WebSocket

**How it works:**
```typescript
// Server
const ws = new WebSocket(request);
ws.addEventListener("message", (event) => {
  // Handle client messages
});
ws.send(JSON.stringify({ type: "token", content: "Hello" }));

// Client
const ws = new WebSocket("wss://api.example.com/debate");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Pros:**
- ✅ Bidirectional communication
- ✅ Low latency
- ✅ Widely supported
- ✅ Can handle high-frequency updates

**Cons:**
- ❌ Overkill for unidirectional streaming
- ❌ Requires persistent connection management (heartbeats, reconnection logic)
- ❌ More complex to implement and test
- ❌ Cloudflare Workers charges for connection duration (not ideal for longer debates)

---

### Option 2: Server-Sent Events (SSE)

**How it works:**
```typescript
// Server (Hono + Workers)
app.get("/api/debate", (c) => {
  return streamText(c, async (stream) => {
    await stream.writeData(JSON.stringify({ type: "start" }));
    await stream.writeData(JSON.stringify({ type: "token", content: "Hello" }));
    await stream.writeData(JSON.stringify({ type: "done" }));
  });
});

// Client
const eventSource = new EventSource("/api/debate?topic=AI");
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Pros:**
- ✅ Designed for server-to-client streaming (our exact use case)
- ✅ Built on standard HTTP (no special protocol)
- ✅ Auto-reconnects on connection drop (built into EventSource API)
- ✅ Simple to implement (especially with Hono's `streamText` helper)
- ✅ Works over HTTP/1.1 and HTTP/2
- ✅ Easier to debug (can test with `curl`)

**Cons:**
- ⚠️ Unidirectional only (not a con for our use case)
- ⚠️ Browser limit of 6 concurrent SSE connections per domain (not an issue for single debate page)

---

### Option 3: Long Polling

**How it works:**
```typescript
// Client repeatedly requests updates
async function pollDebate(debateId) {
  while (true) {
    const response = await fetch(`/api/debate/${debateId}/next`);
    const data = await response.json();
    if (data.done) break;
    displayToken(data.token);
  }
}
```

**Pros:**
- ✅ Works everywhere (even ancient browsers)
- ✅ Simple concept

**Cons:**
- ❌ High latency (each poll requires new HTTP request)
- ❌ Inefficient (creates many TCP connections)
- ❌ Complex server state management
- ❌ Poor user experience (jerky updates)

**Verdict:** ❌ Outdated technique, not suitable for modern streaming

---

## Decision

Use **Server-Sent Events (SSE)** for streaming agent debate output.

---

## Rationale

### 1. Perfect Fit for Unidirectional Streaming

**Our Communication Pattern:**
```
Server → Client: "Optimist is starting..."
Server → Client: "I"
Server → Client: " believe"
Server → Client: " AI"
Server → Client: "..."
Client → Server: (nothing — just listens)
```

**SSE is Designed for This:**
- No need for client-to-server channel
- Server controls event flow
- Client is a passive consumer

**WebSocket Would Be Wasted:**
```typescript
// Unnecessary bidirectional setup
ws.send(/* client never sends anything mid-debate */);
```

---

### 2. Simpler Implementation

**SSE with Hono (our actual code):**
```typescript
import { Hono } from "hono";
import { streamText } from "hono/streaming";

app.post("/api/debate", async (c) => {
  const { topic } = await c.req.json();

  return streamText(c, async (stream) => {
    const graph = createDebateGraph(c.env.GROQ_API_KEY);

    for await (const event of await graph.streamEvents({ messages: [new HumanMessage(topic)] })) {
      if (event.event === "on_chat_model_stream") {
        await stream.writeData(JSON.stringify({
          type: "token",
          content: event.data.chunk.content,
        }));
      }
    }

    await stream.writeData(JSON.stringify({ type: "done" }));
  });
});
```

**Equivalent WebSocket Code:**
```typescript
import { WebSocketHandler } from "@cloudflare/workers-types";

const ws: WebSocketHandler = {
  async fetch(request, env) {
    const [client, server] = Object.values(new WebSocketPair());

    server.accept();

    // Need to handle connection lifecycle
    server.addEventListener("close", () => { /* cleanup */ });
    server.addEventListener("error", (e) => { /* error handling */ });

    // Need to implement ping/pong for keep-alive
    const interval = setInterval(() => {
      server.send(JSON.stringify({ type: "ping" }));
    }, 30000);

    // Now can finally send debate data
    const graph = createDebateGraph(env.GROQ_API_KEY);
    for await (const event of await graph.streamEvents(...)) {
      server.send(JSON.stringify({ type: "token", content: event.data.chunk.content }));
    }

    clearInterval(interval);
    server.close();

    return new Response(null, { status: 101, webSocket: client });
  },
};
```

**Lines of Code:**
- SSE: ~15 lines
- WebSocket: ~35 lines + need separate client reconnection logic

---

### 3. Built-In Reconnection

**SSE EventSource API:**
```typescript
// Client
const eventSource = new EventSource("/api/debate");

// Browser automatically reconnects on:
// - Network interruption
// - Server restart
// - Cloudflare Workers cold start

eventSource.onerror = (error) => {
  // Only need custom handling for permanent failures
  if (eventSource.readyState === EventSource.CLOSED) {
    console.error("Connection permanently closed");
  }
  // Temporary failures auto-retry (no code needed)
};
```

**WebSocket:**
```typescript
// Client must implement custom reconnection logic
let ws;
let reconnectAttempts = 0;

function connect() {
  ws = new WebSocket("wss://...");

  ws.onclose = () => {
    if (reconnectAttempts < 5) {
      reconnectAttempts++;
      setTimeout(connect, 1000 * reconnectAttempts);  // Exponential backoff
    }
  };

  ws.onerror = () => {
    ws.close();
  };
}

connect();
```

**Saved Effort:** ~50 lines of reconnection logic + testing

---

### 4. HTTP/2 Multiplexing

**Problem with HTTP/1.1:**
- Browser limit: 6 concurrent connections per domain
- Each SSE connection consumes one slot

**Solution with HTTP/2 (Cloudflare default):**
- Multiplexes multiple streams over one TCP connection
- No practical limit on concurrent SSE connections
- Our use case (1 debate at a time) well within limits

**Comparison:**
- **SSE over HTTP/2:** Efficient multiplexing
- **WebSocket:** Requires separate connection anyway

---

### 5. Easier Testing and Debugging

**SSE with curl:**
```bash
curl -N -H "Accept: text/event-stream" https://api.example.com/debate?topic=AI

# Output (human-readable):
data: {"type":"start","agent":"Optimist"}

data: {"type":"token","content":"I"}

data: {"type":"token","content":" believe"}

data: {"type":"done"}
```

**WebSocket with curl:**
```bash
# Not supported — need specialized tools like wscat
npm install -g wscat
wscat -c wss://api.example.com/debate
# Still harder to test than SSE
```

**Developer Experience:**
- SSE: Can test with curl, browser, or any HTTP client
- WebSocket: Requires special tools

---

### 6. Cloudflare Workers Compatibility

**SSE:**
- Fully supported via `Response` with `ReadableStream`
- Hono's `streamText` handles all boilerplate
- No special Workers configuration needed

**WebSocket:**
- Requires [Durable Objects](https://developers.cloudflare.com/durable-objects/) for connection state
- More complex setup in `wrangler.jsonc`
- Higher cost (charged per connection duration)

**Setup Time:**
- SSE: 0 minutes (works out of the box)
- WebSocket: ~30-60 minutes (Durable Objects configuration)

---

## When to Use WebSocket Instead

WebSocket is the better choice when:

1. **Bidirectional communication is required**
   ```
   Example: Multiplayer game where client sends moves and receives opponent moves
   ```

2. **Very high-frequency updates**
   ```
   Example: Stock ticker updating 10+ times per second
   ```

3. **Client needs to interrupt server**
   ```
   Example: User clicks "Stop generating" button mid-response
   ```

**Our Use Case:**
- ❌ Client doesn't send data during debate
- ❌ Updates are ~2-5 per second (LLM token rate)
- ❌ No "stop" button in MVP

**Conclusion:** None of these apply to our debate platform.

---

## Implementation Details

### SSE Event Format

**Standard SSE Message:**
```
data: {"type":"token","content":"Hello"}

data: {"type":"done"}
```

**Field Explanation:**
- `data:` prefix is required by SSE spec
- JSON payload allows structured events
- Double newline `\n\n` separates events

---

### Event Types

```typescript
// types.ts
type SSEEvent =
  | { type: "agent_start"; agent: "Optimist" | "Skeptic" | "Moderator" }
  | { type: "token"; content: string }
  | { type: "agent_end"; agent: string }
  | { type: "done" }
  | { type: "error"; message: string };
```

---

### Frontend Implementation

```typescript
// frontend/app/debate/page.tsx
"use client";

import { useState } from "react";

export default function DebatePage() {
  const [messages, setMessages] = useState<string[]>([]);

  const startDebate = async (topic: string) => {
    const response = await fetch("/api/debate", {
      method: "POST",
      body: JSON.stringify({ topic }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const json = line.slice(6);  // Remove "data: " prefix
          const event = JSON.parse(json);

          if (event.type === "token") {
            setMessages((prev) => [...prev, event.content]);
          }
        }
      }
    }
  };

  return (
    <div>
      <button onClick={() => startDebate("Should AI be regulated?")}>
        Start Debate
      </button>
      <div>{messages.join("")}</div>
    </div>
  );
}
```

**Or use `EventSource` API (simpler):**
```typescript
const eventSource = new EventSource("/api/debate?topic=AI");
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "token") {
    setMessages((prev) => [...prev, data.content]);
  }
};
```

---

## Consequences

### Positive

✅ **Simple implementation** — ~15 lines of server code with Hono
✅ **Built-in reconnection** — no custom logic needed
✅ **Easy debugging** — works with curl and browser DevTools
✅ **Perfect for use case** — unidirectional streaming
✅ **No extra infrastructure** — works on Cloudflare Workers out of the box

### Negative

⚠️ **Unidirectional only** — can't implement "user interrupts agent" feature (acceptable for MVP)
⚠️ **Browser limit** — 6 concurrent SSE connections per domain (not an issue for 1 debate at a time)

### Neutral

🔄 **Could migrate to WebSocket later if needed** — but unlikely to be necessary

---

## References

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Hono Streaming Helper](https://hono.dev/helpers/streaming)
- [Cloudflare Workers Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

---

## Revision History

| Date       | Version | Changes                                      |
|------------|---------|----------------------------------------------|
| 2025-11-26 | 1.0     | Decision to use SSE for real-time streaming  |
