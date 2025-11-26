# ADR-003: Groq as LLM Provider

**Status:** Accepted
**Date:** 2025-11-26
**Deciders:** Development Team
**Context:** Cost constraints and performance requirements for MVP

---

## Context

The AI debate platform requires an LLM provider for generating agent responses. Key requirements:

1. **Cost:** Must have a generous free tier (budget constraint for MVP/portfolio project)
2. **Performance:** Should support streaming for real-time user experience
3. **Quality:** Must produce coherent multi-turn conversations
4. **Latency:** Prefer <1 second response times for engaging UX
5. **Reliability:** Stable API with good uptime

---

## Options Considered

### Option 1: OpenAI (gpt-4o-mini)

**Pros:**
- Excellent quality and reasoning
- Comprehensive documentation
- Industry standard
- Very reliable

**Cons:**
- **No free tier** — costs ~$0.15/1M input tokens, $0.60/1M output tokens
- For 3-round debate: ~3000 tokens/session × 100 test runs = $0.27 (adds up quickly)

**Verdict:** ❌ Cost prohibitive for experimentation phase

---

### Option 2: Anthropic (Claude 3 Haiku)

**Pros:**
- High quality outputs
- Good at following instructions
- $0.25/1M input tokens

**Cons:**
- **No free tier**
- Still paid during development
- Slightly slower than Groq

**Verdict:** ❌ Cost concern

---

### Option 3: Groq (llama-3.1-8b-instant)

**Pros:**
- **Free tier: 30 requests/minute, 14,400 tokens/minute**
- Extremely fast inference (~400 tokens/second) via custom LPU hardware
- Good enough quality for debate scenarios
- Official LangChain integration (`@langchain/groq`)
- Supports streaming

**Cons:**
- Rate limits could be restrictive for production use
- Model quality slightly below GPT-4 (but acceptable for MVP)
- Groq is a newer company (potential service stability concerns)

**Verdict:** ✅ Best fit for MVP phase

---

### Option 4: OpenRouter (aggregator)

**Pros:**
- Access to multiple models through one API
- Flexibility to switch models
- Some free models available

**Cons:**
- Free models often have lower quality
- No significant advantage over using Groq directly
- Additional abstraction layer

**Verdict:** ⚠️ Possible fallback option

---

## Decision

Use **Groq with llama-3.1-8b-instant model** as the primary LLM provider.

---

## Rationale

### 1. Free Tier Enables Rapid Iteration

**Problem:** During development, we need to:
- Run 50-100+ tests to refine agent prompts
- Experiment with different prompt engineering strategies
- Demo the platform multiple times

**Calculation:**
- Each debate session: ~3,000 tokens (3 rounds × 2 agents × ~500 tokens/response)
- 100 test runs: 300,000 tokens
- **With OpenAI:** ~$0.45 cost
- **With Groq:** $0 cost

**Impact:** Zero-cost experimentation allows for higher quality prompts without budget anxiety.

---

### 2. Speed Enhances User Experience

**Groq Benchmark:**
```
Time to First Token (TTFT): ~50ms
Tokens per Second: ~400
Total time for 500-token response: ~1.3 seconds
```

**OpenAI Benchmark (gpt-4o-mini):**
```
TTFT: ~200ms
Tokens per Second: ~80
Total time for 500-token response: ~6.5 seconds
```

**User Impact:**
- 3-round debate with Groq: ~8-10 seconds total
- 3-round debate with OpenAI: ~40-50 seconds total

**Conclusion:** Groq's 5x speed advantage creates a far more engaging demo experience.

---

### 3. Quality is "Good Enough" for MVP

**Llama 3.1 8B Capabilities:**
- ✅ Coherent multi-turn conversations
- ✅ Can follow system prompts ("argue positively", "challenge critically")
- ✅ Generates 2-3 sentence responses reliably
- ⚠️ Occasionally produces generic arguments
- ⚠️ May struggle with highly technical topics

**Test Example:**
```
Topic: "Should AI replace human artists?"

Optimist (Llama 3.1 8B):
"AI can democratize art creation, allowing anyone to express their creativity
without years of training. It can also assist human artists by handling tedious
tasks, freeing them to focus on conceptual work."

Quality Rating: 7/10 (Clear argument, lacks deep nuance)
```

**Verdict:** Sufficient for portfolio project. If needed for production, can swap to gpt-4o-mini later (thanks to LangChain abstraction).

---

### 4. LangChain Integration is Seamless

```typescript
import { ChatGroq } from "@langchain/groq";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant",
  temperature: 0.7,
  streaming: true,  // Works out of the box
});

// Can swap to OpenAI later with minimal changes:
// import { ChatOpenAI } from "@langchain/openai";
// const model = new ChatOpenAI({ ... });
```

**Migration Effort:** <30 minutes to switch providers if needed.

---

## Rate Limit Strategy

### Current Limits
- **30 requests per minute**
- **14,400 tokens per minute**

### Our Usage Pattern
- One debate = 6 LLM calls (3 rounds × 2 agents) + 1 moderator call = 7 total
- 7 calls × ~500 tokens/call = ~3,500 tokens
- **Conclusion:** Can handle ~4 concurrent debate sessions per minute

### Mitigation Plan

**For MVP (acceptable):**
- Show loading spinner with "Agent is thinking..." message
- Most users won't hit rate limits during demos

**For Production (future):**
1. Implement exponential backoff retry logic
2. Add request queuing system
3. Consider Groq's paid tier ($0.05/1M tokens — still 3x cheaper than OpenAI)
4. Or migrate to OpenAI for production workload

---

## Consequences

### Positive

✅ **Zero development cost** — can iterate freely
✅ **Sub-second responses** — creates impressive demo experience
✅ **Streaming support** — enables typewriter effect in UI
✅ **Simple integration** — one npm package, one API key
✅ **Future-proof** — easy to swap providers via LangChain abstraction

### Negative

⚠️ **Rate limits** — may need queuing for production
⚠️ **Quality ceiling** — not suitable for production applications requiring GPT-4 level reasoning
⚠️ **Vendor risk** — Groq is a younger company (though backed by significant funding)

### Neutral

🔄 **Good enough for MVP, revisit for production** — acceptable trade-off for portfolio project

---

## Monitoring & Fallback Plan

### Health Checks
```typescript
// backend/src/health.ts
export async function checkGroqHealth() {
  try {
    const model = new ChatGroq({ apiKey: process.env.GROQ_API_KEY });
    await model.invoke([new HumanMessage("test")]);
    return { status: "healthy" };
  } catch (error) {
    if (error.status === 429) {
      return { status: "rate_limited", retryAfter: error.headers["retry-after"] };
    }
    return { status: "unhealthy", error: error.message };
  }
}
```

### Fallback Providers

**Priority Order:**
1. Groq (primary)
2. OpenAI gpt-4o-mini (if Groq is down)
3. Local Ollama instance (for offline development)

**Implementation:**
```typescript
// backend/src/llm-factory.ts
export function createLLM(provider: "groq" | "openai" | "ollama") {
  switch (provider) {
    case "groq":
      return new ChatGroq({ apiKey: process.env.GROQ_API_KEY, model: "llama-3.1-8b-instant" });
    case "openai":
      return new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" });
    case "ollama":
      return new ChatOllama({ baseUrl: "http://localhost:11434", model: "llama3.1" });
  }
}
```

---

## Cost Comparison Table

| Provider | Model | Input Cost | Output Cost | Free Tier | 100 Debates Cost |
|----------|-------|-----------|------------|-----------|-----------------|
| **Groq** | llama-3.1-8b-instant | $0 | $0 | 14.4K TPM | **$0** |
| OpenAI | gpt-4o-mini | $0.15/1M | $0.60/1M | None | ~$0.45 |
| Anthropic | Claude 3 Haiku | $0.25/1M | $1.25/1M | None | ~$0.75 |
| OpenRouter | Free models | Varies | Varies | Limited | $0 (but lower quality) |

**Winner for MVP:** Groq

---

## References

- [Groq API Documentation](https://console.groq.com/docs)
- [Groq Pricing](https://wow.groq.com/pricing/)
- [LangChain Groq Integration](https://js.langchain.com/docs/integrations/chat/groq)
- [Llama 3.1 Model Card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md)

---

## Revision History

| Date       | Version | Changes                                      |
|------------|---------|----------------------------------------------|
| 2025-11-26 | 1.0     | Initial decision to use Groq for MVP         |
