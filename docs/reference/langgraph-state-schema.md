# LangGraph State Schema Reference

**Version:** 1.0.0
**Last Updated:** 2025-11-26

---

## Overview

This document defines the TypeScript interfaces and reducer configurations for all state objects used in the AI Debate Platform's LangGraph workflows.

---

## Core State Interface

### `DebateState`

The primary state object shared across all agent nodes in the debate workflow.

```typescript
import { BaseMessage } from "@langchain/core/messages";

interface DebateState {
  messages: BaseMessage[];
  round: number;
  topic: string;
  maxRounds: number;
  status: DebateStatus;
}

type DebateStatus = "running" | "completed" | "error";
```

#### Field Descriptions

| Field | Type | Description | Initial Value |
|-------|------|-------------|---------------|
| `messages` | `BaseMessage[]` | Complete conversation history including user input and all agent responses | `[]` |
| `round` | `number` | Current debate round counter (0-indexed) | `0` |
| `topic` | `string` | The debate subject provided by the user | User-provided |
| `maxRounds` | `number` | Maximum number of debate rounds before termination | `3` (configurable) |
| `status` | `DebateStatus` | Current workflow execution status | `"running"` |

---

## Reducer Configurations

### StateGraph Channel Definition

```typescript
import { StateGraph } from "@langchain/langgraph";

const workflow = new StateGraph<DebateState>({
  channels: {
    messages: {
      reducer: messagesReducer,
      default: () => [],
    },
    round: {
      reducer: roundReducer,
      default: () => 0,
    },
    topic: {
      reducer: immutableReducer,
      default: () => "",
    },
    maxRounds: {
      reducer: immutableReducer,
      default: () => 3,
    },
    status: {
      reducer: statusReducer,
      default: () => "running",
    },
  },
});
```

---

### `messagesReducer`

**Purpose:** Appends new messages to the conversation history.

```typescript
const messagesReducer = (
  current: BaseMessage[],
  update: BaseMessage[]
): BaseMessage[] => {
  return current.concat(update);
};
```

**Behavior:**
- **Current:** `[msg1, msg2]`
- **Update:** `[msg3]`
- **Result:** `[msg1, msg2, msg3]`

**Use Case:** All agent nodes return `{ messages: [newMessage] }`, and this reducer ensures they're appended to the history.

---

### `roundReducer`

**Purpose:** Overwrites the round counter with the latest value.

```typescript
const roundReducer = (_current: number, update: number): number => {
  return update;
};
```

**Behavior:**
- **Current:** `2`
- **Update:** `3`
- **Result:** `3`

**Use Case:** Skeptic node increments the round counter: `{ round: state.round + 1 }`.

**Note:** We discard `_current` because round is a simple counter — the update always takes precedence.

---

### `immutableReducer`

**Purpose:** Prevents updates to fields that should never change after initialization.

```typescript
const immutableReducer = <T>(current: T, _update: T): T => {
  return current;
};
```

**Behavior:**
- **Current:** `"Should AI be regulated?"`
- **Update:** `"Different topic"` (attempt to overwrite)
- **Result:** `"Should AI be regulated?"` (ignored)

**Use Case:** Fields like `topic` and `maxRounds` are set at the start and should never change mid-debate.

---

### `statusReducer`

**Purpose:** Updates workflow status, with validation.

```typescript
const statusReducer = (
  _current: DebateStatus,
  update: DebateStatus
): DebateStatus => {
  if (!["running", "completed", "error"].includes(update)) {
    throw new Error(`Invalid status: ${update}`);
  }
  return update;
};
```

**Behavior:**
- **Current:** `"running"`
- **Update:** `"completed"`
- **Result:** `"completed"`

**Use Case:** Moderator node sets status to `"completed"` when debate finishes.

---

## Extended State (Future v2.0)

Planned extensions for additional features:

```typescript
interface ExtendedDebateState extends DebateState {
  // Human-in-the-loop approval
  awaitingApproval: boolean;
  userApproved: boolean | null;

  // Fact-checking
  factCheckResults: FactCheckResult[];

  // Analytics
  tokenUsage: number;
  startTime: Date;
  endTime: Date | null;
}

interface FactCheckResult {
  claim: string;
  verdict: "true" | "false" | "unverifiable";
  sources: string[];
}
```

**Status:** Not implemented in MVP (documented for future reference)

---

## Node Return Type

### `Partial<DebateState>`

All agent nodes return partial state updates:

```typescript
type NodeFunction = (state: DebateState) => Promise<Partial<DebateState>>;
```

**Example:**
```typescript
const optimistNode: NodeFunction = async (state) => {
  const response = await model.invoke([...state.messages, prompt]);

  // Only return fields to update
  return {
    messages: [response],  // Appended by messagesReducer
    // round is not returned, so it remains unchanged
  };
};
```

**Why Partial?**
- Nodes only update relevant fields
- Reducers handle merging with existing state
- Type-safe: can't accidentally overwrite unrelated fields

---

## State Access Patterns

### Reading State

```typescript
const myNode = async (state: DebateState) => {
  // Access any state field
  const history = state.messages;
  const currentRound = state.round;
  const debateTopic = state.topic;

  // ...
};
```

### Updating State

```typescript
// ✅ Correct: Return partial updates
return {
  messages: [newMessage],
  round: state.round + 1,
};

// ❌ Incorrect: Mutating state directly
state.messages.push(newMessage);  // Don't do this!
state.round++;  // Don't do this!

// ❌ Incorrect: Returning full state
return { ...state, round: state.round + 1 };  // Unnecessary
```

---

## Initial State Construction

### API Endpoint

```typescript
// backend/src/routes/debate.ts
app.post("/api/debate", async (c) => {
  const { topic, maxRounds = 3 } = await c.req.json();

  const initialState: DebateState = {
    messages: [new HumanMessage(`Debate topic: ${topic}`)],
    round: 0,
    topic,
    maxRounds,
    status: "running",
  };

  const graph = createDebateGraph(c.env.GROQ_API_KEY);
  const stream = await graph.streamEvents(initialState, { version: "v2" });

  // ... stream events to SSE
});
```

---

## Validation

### Runtime Validation with Zod (Optional)

```typescript
import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";

const DebateStateSchema = z.object({
  messages: z.array(z.custom<BaseMessage>()),
  round: z.number().int().min(0),
  topic: z.string().min(1),
  maxRounds: z.number().int().min(1).max(10),
  status: z.enum(["running", "completed", "error"]),
});

// Use in node
const validatedState = DebateStateSchema.parse(state);
```

**Note:** Not implemented in MVP (TypeScript types are sufficient).

---

## State Serialization

### For Persistent Checkpointing (Future)

```typescript
// Convert to JSON for storage in KV
function serializeState(state: DebateState): string {
  return JSON.stringify({
    ...state,
    messages: state.messages.map((msg) => ({
      type: msg.constructor.name,
      content: msg.content,
    })),
  });
}

// Restore from JSON
function deserializeState(json: string): DebateState {
  const data = JSON.parse(json);
  return {
    ...data,
    messages: data.messages.map((msg: any) =>
      msg.type === "HumanMessage"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    ),
  };
}
```

**Status:** Not needed for MemorySaver (in-memory checkpointing).

---

## Examples

### Complete Node Implementation

```typescript
import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant",
});

export const optimistNode = async (
  state: DebateState
): Promise<Partial<DebateState>> => {
  // Validate state
  if (!state.topic) {
    return {
      status: "error",
      messages: [new AIMessage("Error: No topic provided")],
    };
  }

  // Call LLM with context
  const response = await model.invoke([
    ...state.messages,
    new HumanMessage(
      `You are an optimistic debater. Argue the positive side of: ${state.topic}. ` +
      `Keep your response to 2-3 sentences.`
    ),
  ]);

  // Return state updates
  return {
    messages: [response],
    // round unchanged (will be updated by skeptic node)
  };
};
```

---

## Changelog

| Version | Date       | Changes                                         |
|---------|------------|-------------------------------------------------|
| 1.0.0   | 2025-11-26 | Initial state schema for MVP                    |
| 1.1.0   | TBD        | Add `ExtendedDebateState` for v2.0 features     |

---

## See Also

- [ADR-001: LangGraph Architecture](../adr/001-langgraph-for-agent-orchestration.md)
- [Tutorial: Understanding LangGraph Basics](../tutorials/02-understanding-langgraph-basics.md)
- [Explanation: State Reducers](../explanation/state-reducers-explained.md)
