# API Specification

**Version:** 1.0.0 (Draft)
**Status:** 📝 Documentation-First (Implementation in Progress)
**Base URL:** `https://your-app.pages.dev` (or `http://localhost:8787` for local dev)
**Protocol:** HTTPS
**Authentication:** None (MVP), API keys in future versions

> **⚠️ Implementation Note:** This API specification represents the planned design. Backend implementation is in progress. See [Project Status](../../README.md#-project-status) for current progress.

---

## Endpoints

### POST `/api/debate`

Initiates a new AI debate session and streams agent responses in real-time using Server-Sent Events (SSE).

#### Request

**Method:** `POST`
**Content-Type:** `application/json`
**Accept:** `text/event-stream`

> **📌 HTTP Method Clarification:** This endpoint uses POST to accept debate configuration in the request body. SSE streaming is returned in the response. Note that the browser `EventSource` API only supports GET requests, so frontend implementations must use `fetch()` with `ReadableStream` instead (see client implementation examples below).

**Body Parameters:**

```typescript
interface DebateRequest {
  topic: string;        // Required: The debate subject
  maxRounds?: number;   // Optional: Number of rounds (default: 3, max: 5)
}
```

**Example:**
```json
{
  "topic": "Should artificial intelligence be regulated by governments?",
  "maxRounds": 3
}
```

**Validation:**
- `topic`: Must be non-empty string, max 500 characters
- `maxRounds`: Must be integer between 1 and 5

---

#### Response

**Status Code:** `200 OK`
**Content-Type:** `text/event-stream`
**Transfer-Encoding:** `chunked`

**SSE Event Format:**

Each event is a JSON payload prefixed with `data:` and followed by two newlines:

```
data: {"type":"event_type","payload":{...}}

```

---

### SSE Event Types

#### 1. `agent_start`

Emitted when an agent begins execution.

```typescript
{
  "type": "agent_start",
  "agent": "Optimist" | "Skeptic" | "Moderator",
  "round": number,
  "timestamp": string  // ISO 8601
}
```

**Example:**
```json
{
  "type": "agent_start",
  "agent": "Optimist",
  "round": 0,
  "timestamp": "2025-11-26T10:30:00.000Z"
}
```

---

#### 2. `token`

Emitted for each LLM output token (streamed).

```typescript
{
  "type": "token",
  "content": string,    // Single token or word
  "agent": string       // Current speaking agent
}
```

**Example:**
```json
{
  "type": "token",
  "content": "I",
  "agent": "Optimist"
}
```

**Note:** Tokens arrive at ~400 tokens/second (Groq speed).

---

#### 3. `agent_end`

Emitted when an agent completes its turn.

```typescript
{
  "type": "agent_end",
  "agent": string,
  "round": number,
  "fullMessage": string,  // Complete agent response
  "tokenCount": number
}
```

**Example:**
```json
{
  "type": "agent_end",
  "agent": "Optimist",
  "round": 0,
  "fullMessage": "I believe AI regulation will ensure ethical development...",
  "tokenCount": 87
}
```

---

#### 4. `round_complete`

Emitted when both agents finish a round.

```typescript
{
  "type": "round_complete",
  "round": number,
  "totalRounds": number
}
```

**Example:**
```json
{
  "type": "round_complete",
  "round": 1,
  "totalRounds": 3
}
```

---

#### 5. `debate_complete`

Emitted when the entire debate finishes.

```typescript
{
  "type": "debate_complete",
  "summary": string,        // Moderator's summary
  "totalTokens": number,
  "duration": number,       // Milliseconds
  "transcript": Message[]
}

interface Message {
  role: "Optimist" | "Skeptic" | "Moderator";
  content: string;
  round: number;
}
```

**Example:**
```json
{
  "type": "debate_complete",
  "summary": "Both sides presented valid arguments. The optimist highlighted...",
  "totalTokens": 1247,
  "duration": 12400,
  "transcript": [
    { "role": "Optimist", "content": "...", "round": 0 },
    { "role": "Skeptic", "content": "...", "round": 0 }
  ]
}
```

---

#### 6. `error`

Emitted when an error occurs.

```typescript
{
  "type": "error",
  "message": string,
  "code": string,
  "retryable": boolean
}
```

**Example:**
```json
{
  "type": "error",
  "message": "Groq API rate limit exceeded",
  "code": "RATE_LIMIT",
  "retryable": true
}
```

**Error Codes:**
- `INVALID_TOPIC` — Topic validation failed
- `RATE_LIMIT` — Groq API rate limit hit
- `LLM_ERROR` — LLM invocation failed
- `INTERNAL_ERROR` — Unexpected server error

---

## Client Implementation

### JavaScript (Browser)

#### Using `fetch` + `ReadableStream`

```javascript
async function startDebate(topic) {
  const response = await fetch("/api/debate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, maxRounds: 3 }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const event = JSON.parse(line.slice(6));
        handleEvent(event);
      }
    }
  }
}

function handleEvent(event) {
  switch (event.type) {
    case "token":
      appendToken(event.content);
      break;
    case "agent_start":
      console.log(`${event.agent} is speaking...`);
      break;
    case "debate_complete":
      console.log("Debate finished:", event.summary);
      break;
  }
}
```

---

#### ~~Using `EventSource` API~~ (Not Compatible)

> **⚠️ Important:** The `EventSource` API only supports GET requests and cannot send a request body. Since our `/api/debate` endpoint requires POST with JSON body (to accept `topic` and `maxRounds`), **EventSource cannot be used**.
>
> **Use `fetch()` with `ReadableStream` instead** as shown in the example above.
>
> **Alternative Design (Future):** If GET support is needed, we could implement a two-step process:
> 1. POST `/api/debate/create` → Returns `debateId`
> 2. GET `/api/debate/{debateId}/stream` → EventSource connects here
>
> This is not implemented in MVP to keep the API simple.

---

### React Hook Example

```typescript
// hooks/useDebate.ts
import { useState, useEffect } from "react";

interface Message {
  role: string;
  content: string;
}

export function useDebate(topic: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startDebate = async () => {
    setIsLoading(true);
    setMessages([]);

    const response = await fetch("/api/debate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let currentAgent = "";
    let currentMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const event = JSON.parse(line.slice(6));

          if (event.type === "agent_start") {
            currentAgent = event.agent;
            currentMessage = "";
          } else if (event.type === "token") {
            currentMessage += event.content;
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: currentAgent, content: currentMessage },
            ]);
          } else if (event.type === "agent_end") {
            setMessages((prev) => [
              ...prev,
              { role: currentAgent, content: event.fullMessage },
            ]);
          }
        }
      }
    }

    setIsLoading(false);
  };

  return { messages, isLoading, startDebate };
}
```

**Usage:**
```tsx
function DebatePage() {
  const { messages, isLoading, startDebate } = useDebate();

  return (
    <div>
      <button onClick={() => startDebate("AI regulation")}>
        Start Debate
      </button>
      {messages.map((msg, i) => (
        <div key={i}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}
```

---

## Rate Limiting

**Current (MVP):** No rate limiting (relies on Groq's 30 req/min limit)

**Future (v2.0):**
- Per-IP: 10 debates/hour
- Per-topic: Cache responses for identical topics (1-hour TTL)

---

## Testing

### cURL Example

```bash
curl -N -X POST https://your-app.pages.dev/api/debate \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"topic":"Should AI be regulated?","maxRounds":2}'
```

**Expected Output:**
```
data: {"type":"agent_start","agent":"Optimist","round":0}

data: {"type":"token","content":"I","agent":"Optimist"}

data: {"type":"token","content":" believe","agent":"Optimist"}

data: {"type":"agent_end","agent":"Optimist","round":0,...}

...
```

---

### Automated Testing

```typescript
// backend/test/api.spec.ts
import { describe, it, expect } from "vitest";

describe("POST /api/debate", () => {
  it("should stream debate events", async () => {
    const response = await fetch("http://localhost:8787/api/debate", {
      method: "POST",
      body: JSON.stringify({ topic: "Test topic" }),
    });

    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);

    expect(chunk).toContain("data:");
    expect(chunk).toContain("agent_start");
  });
});
```

---

## Future Endpoints (v2.0)

### GET `/api/debates/:id`

Retrieve historical debate transcript.

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "groq": "up",
    "langgraph": "up"
  }
}
```

---

## Changelog

| Version | Date       | Changes                                |
|---------|------------|----------------------------------------|
| 1.0.0   | 2025-11-26 | Initial API spec for MVP               |
| 1.1.0   | TBD        | Add rate limiting and caching          |

---

## See Also

- [LangGraph State Schema](./langgraph-state-schema.md)
- [Local Development Guide](../guides/local-development.md)
- [SSE vs WebSocket ADR](../adr/005-sse-over-websocket.md)
