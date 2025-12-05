# DebateAI 專案實施指南

> **本文件包含完整的技術實施細節、程式碼範例和部署指南**

## 目錄

- [專案現狀](#專案現狀)
- [可行性評估](#可行性評估)
- [關鍵技術決策](#關鍵技術決策)
- [開發時程](#開發時程)
- [Phase 0: 專案初始化](#phase-0-專案初始化)
- [Phase 1: 基礎架構連通](#phase-1-基礎架構連通)
- [Phase 2: 接入 LangGraph 與 Groq](#phase-2-接入-langgraph-與-groq)
- [Phase 3: 工具調用與完善](#phase-3-工具調用與完善)
- [關鍵技術要點](#關鍵技術要點)
- [風險緩解策略](#風險緩解策略)
- [前端 UI 組件 (shadcn/ui)](#前端-ui-組件-shadcnui)

---

## 前端 UI 組件 (shadcn/ui)

> **更新日期**: 2025-12-05
>
> 本專案採用 [shadcn/ui](https://ui.shadcn.com/) 作為 UI 組件庫，搭配 Tailwind CSS 實現 Cyberpunk 風格的暗色主題。

### 技術堆疊

| 套件                       | 版本   | 用途                                       |
| -------------------------- | ------ | ------------------------------------------ |
| `shadcn/ui`                | -      | 基礎 UI 組件（Button, Input, Card, Badge） |
| `class-variance-authority` | ^0.7   | 組件 variants 管理                         |
| `clsx` + `tailwind-merge`  | -      | 類別名稱合併                               |
| `lucide-react`             | ^0.460 | 圖示庫（Swords, Rocket, Square）           |
| `@radix-ui/react-slot`     | ^1.2   | 組件組合                                   |

### 安裝步驟

```bash
# 1. 安裝依賴
cd frontend
npm install class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot

# 2. 確認 components.json 配置
cat components.json

# 3. 驗證構建
npm run build
```

### 組件結構

```
frontend/
├── components/
│   └── ui/                    # shadcn/ui 基礎組件
│       ├── button.tsx         # 按鈕（gradient, destructive variants）
│       ├── input.tsx          # 輸入框（暗色主題）
│       ├── card.tsx           # 卡片（glassmorphism 風格）
│       └── badge.tsx          # 標籤（optimist/skeptic variants）
├── lib/
│   └── utils.ts               # cn() 工具函數
└── app/
    └── components/            # 業務組件（使用 shadcn/ui）
        ├── MessageBubble.tsx  # 訊息氣泡（Card + Badge）
        ├── TopicForm.tsx      # 表單（Button + Input）
        └── DebateUI.tsx       # 主介面
```

### 自訂 Variants

#### Button Variants

```tsx
// 預設：紫藍漸層
<Button>開始辯論</Button>

// 停止按鈕：紅色 + 脈動動畫
<Button variant="destructive">停止</Button>

// 次要按鈕
<Button variant="secondary">設定</Button>
```

#### Badge Variants（角色專用）

```tsx
// 樂觀者：綠色
<Badge variant="optimist">🤖 樂觀者</Badge>

// 懷疑者：紅色
<Badge variant="skeptic">🧐 懷疑者</Badge>

// 系統訊息
<Badge variant="system">📢 系統</Badge>
```

### 主題配色

| 角色     | 背景色           | 邊框色           | 文字色        |
| -------- | ---------------- | ---------------- | ------------- |
| Optimist | `emerald-950/40` | `emerald-500/30` | `emerald-100` |
| Skeptic  | `rose-950/40`    | `rose-500/30`    | `rose-100`    |
| System   | `slate-800/50`   | `slate-600/30`   | `slate-300`   |

---

## 專案現狀

- **狀態**: Phase 1 前端完成，後端 Fake SSE 完成
- **已完成**:
  - ✅ 前端 Next.js 16 + shadcn/ui 組件整合
  - ✅ 後端 FastAPI + Fake SSE 串流
  - ✅ CORS 配置（Regex 支援 Cloudflare Pages）
  - ✅ 靜態導出配置（Cloudflare Pages）
- **進行中**: Phase 2 - 接入 LangGraph 與 Groq

---

## 可行性評估

### ✅ 優勢（高可行性因素）

1. **完整的技術規劃**

   - 清晰的三階段開發路線圖
   - 詳細的技術堆疊選型
   - 明確的部署策略

2. **成熟的技術選型**

   - **Python LangGraph v1**: 穩定釋出，多 Agent 框架；`create_react_agent` 已 deprecated，建議改用 LangChain `create_agent`（底層仍是 LangGraph）
   - **FastAPI**: 高效能的 Python web 框架，原生支援 async/SSE
   - **Next.js 14+**: 穩定的 React 框架
   - **Groq**: 業界領先的推理速度（300+ tokens/sec）
   - **uv**: 現代化的 Python 工具鏈

3. **成本優化**

   - Google Cloud Run: 慷慨的免費額度（每月 200 萬次請求）
   - Cloudflare Pages: 完全免費的靜態託管
   - Tavily: 1000 次/月免費搜尋
   - Groq: 每日有免費額度

4. **架構合理性**
   - 前後端分離，職責清晰
   - SSE 適合 AI 串流場景
   - Docker 容器化易於部署

### 📊 可行性結論

**總體評分: 9/10 (高度可行)**

- ✅ 技術選型合理且成熟
- ✅ 架構設計清晰可執行
- ✅ 成本可控（接近零成本）
- ✅ 使用現代化工具鏈（uv）
- ⚠️ 需要中等程度的全端開發能力

---

## 🔍 2025-12-03 深度技術驗證與修正

> **本章節基於實際網路查證，針對原計畫進行關鍵修正**

### 🆕 LangGraph v1 重點（穩定釋出）

- v1 為穩定版，核心 graph/state/node/edge 模型與執行行為保持不變，升級成本低（`pip install -U langgraph`/`uv add langgraph` 即可）。
- 官方已將 LangGraph 的 `create_react_agent` 標示 deprecated，建議改用 LangChain v1 的 `create_agent`（底層仍跑 LangGraph）。
- checkpointing/persistence/streaming/human-in-the-loop 仍是一級公民，現有 `astream_events`/`stream` 使用方式可直接沿用。
- 與 LangChain v1 並行設計，可先用 LangChain 高階 API，再視需要下鑽 LangGraph 做自訂 orchestration。

### ✅ 已驗證技術點（2025-12-04 更新）

#### 1. LangGraph v1（穩定版）

**驗證結果：✅ 升級成本低，核心 API 不變**

- v1 是穩定釋出，graph/state/node/edge 執行模型維持原樣，既有程式可直接升級。
- checkpointing、persistence、streaming、human-in-the-loop 持續為一級公民；現有 `astream_events`/`stream` 使用方式可繼續。
- LangGraph 內建的 `create_react_agent` 已被標註為 deprecated，官方建議改用 LangChain v1 的 `create_agent`（底層同樣使用 LangGraph）。

**來源：**

- [LangGraph v1 Release Notes](https://docs.langchain.com/oss/python/releases/langgraph-v1)

#### 2. uv 工具鏈效能

**驗證結果：✅ 宣稱正確，甚至更好**

- 實測速度：比 pip 快 **8-115 倍**（取決於快取）
- JupyterLab 冷安裝：2.6 秒 (uv) vs 21.4 秒 (pip)
- Rust 實現 + 平行下載 + 全域快取
- 官方 Docker 映像（`ghcr.io/astral-sh/uv`）完整支援

**來源：**

- [uv vs pip - Real Python](https://realpython.com/uv-vs-pip/)
- [Python UV Guide - DataCamp](https://www.datacamp.com/tutorial/python-uv)

#### 3. Groq API 免費額度

**驗證結果：✅ 可用但需注意細節**

- `llama-3.1-8b-instant`: 6,000 TPM（每分鐘 token 數）
- 部分模型可達 60,000-150,000 TPM
- ⚠️ **重要修正**：文件中提到的 "300+ tokens/sec" 是**推理速度**而非配額限制
- **建議**：開發時使用 `llama-3.1-8b-instant`（配額更高）

**來源：**

- [Groq Rate Limits Documentation](https://console.groq.com/docs/rate-limits)
- [Groq Pricing](https://groq.com/pricing)

#### 4. 搜尋工具策略

**驗證結果：✅ Tavily 優先策略正確**

- **Tavily**：專為 AI 設計，API 回應 < 1 秒，減少幻覺
- **DuckDuckGo**：完全免費，但不如專業 SERP API 穩定
- **三層容錯策略**：Tavily → DuckDuckGo → 優雅降級（非常合理）

**來源：**

- [Best SERP API Comparison 2025](https://dev.to/ritzaco/best-serp-api-comparison-2025-serpapi-vs-exa-vs-tavily-vs-scrapingdog-vs-scrapingbee-2jci)
- [Tavily Official Website](https://www.tavily.com/)

---

### 🔴 關鍵風險與必要修正

#### 風險 1：Cloudflare Pages + SSE 相容性問題 ⚠️

**問題發現：**
根據網路查證，Cloudflare 對 SSE 支援有**已知限制**：

- Cloudflare Workers 需要特殊的 SSE 擴充
- 可能出現 520 錯誤或連接超時
- EventSource 在 Cloudflare 代理下可能不穩定

**原計畫的矛盾：**

- Phase 1 使用 GET + EventSource（測試用）
- Phase 2+ 改用 POST + fetch + ReadableStream（生產用）

**✅ 修正方案（已定案）：**

從 Phase 1 開始就統一使用 **POST + fetch + ReadableStream**：

```python
# backend/app/main.py
import os
import re
import json
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ✅ 採用 Regex CORS（支援動態域名）
class RegexCORSMiddleware(CORSMiddleware):
    def is_allowed_origin(self, origin: str) -> bool:
        if origin.startswith("http://localhost") or re.match(r"https://.*\.pages\.dev$", origin):
            return True
        return super().is_allowed_origin(origin)

app.add_middleware(
    RegexCORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 預設白名單
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

class DebateRequest(BaseModel):
    topic: str
    max_rounds: int = 3

async def generate_debate_stream(topic: str):
    """✅ 關鍵：異步生成器 + 正確的 SSE 格式"""
    yield f"data: {json.dumps({'type': 'status', 'text': '引擎啟動中...'})}\n\n"
    await asyncio.sleep(0.5)
    # ... 其他邏輯
    yield f"data: {json.dumps({'type': 'complete'})}\n\n"

@app.post("/debate")
async def start_debate(req: DebateRequest):
    return StreamingResponse(
        generate_debate_stream(req.topic),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # ⚠️ 關鍵：防止 Cloudflare 緩衝
        }
    )
```

前端對應實作：

```typescript
// 前端使用 fetch + ReadableStream（不用 EventSource）
const response = await fetch(API_URL + "/debate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ topic, max_rounds: 3 }),
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
      const data = JSON.parse(line.slice(6));
      // 處理不同類型的事件...
    }
  }
}
```

**來源：**

- [EventSource with Cloudflare - Stack Overflow](https://stackoverflow.com/questions/78745060/how-to-make-the-event-stream-eventsource-working-with-cloudflare)
- [Cloudflare Pages Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)

---

#### 風險 2：LangGraph 必須使用 Async 函數 ⚠️

**問題發現：**
原文件中提到 "即使節點內部使用 `invoke`，串流事件仍會被發出"，這是**部分正確**但不完整。

**正確做法：**

```python
# ❌ 錯誤：同步函數 + invoke（會阻塞 Event Loop）
def optimist_node(state: DebateState) -> dict:
    response = llm.invoke(messages)  # 阻塞調用
    return {"messages": [response]}

# ✅ 正確：異步函數 + ainvoke
async def optimist_node(state: DebateState) -> dict:
    """樂觀者 Agent（異步版本）"""
    messages = [
        HumanMessage(content=f"主題：{state['topic']}...")
    ]

    # ⚠️ 使用 ainvoke 而非 invoke
    response = await llm_with_tools.ainvoke(messages)

    # 處理工具調用循環
    while response.tool_calls:
        for tool_call in response.tool_calls:
            result = search_tool.invoke(tool_call["args"])
            messages.append(
                ToolMessage(
                    content=result,
                    tool_call_id=tool_call["id"],
                    name="web_search"
                )
            )
        response = await llm.ainvoke(messages)  # ⚠️ 再次使用 ainvoke

    return {
        "messages": [AIMessage(content=response.content, name="optimist")],
        "current_speaker": "skeptic",
    }
```

**為什麼必須用 async？**

1. FastAPI 的 `StreamingResponse` 是異步的
2. 同步的 `invoke` 會阻塞整個事件循環
3. 多個並發請求時會導致伺服器卡死
4. `astream_events` 才能正確攔截異步調用的串流事件

---

#### 風險 3：CORS 配置的誤解 ⚠️

**原文件的錯誤說明：**

> "⚠️ 重要：不要使用 `*.pages.dev` 通配符（Starlette 不支援）"

**實際情況：**
Starlette **支援**萬用字元，但不建議用於生產環境。

**✅ 正確做法：使用 Regex CORS Middleware**

```python
import re
from fastapi.middleware.cors import CORSMiddleware

class RegexCORSMiddleware(CORSMiddleware):
    def is_allowed_origin(self, origin: str) -> bool:
        # 支援所有 .pages.dev 結尾的域名
        if re.match(r"https://.*\.pages\.dev$", origin):
            return True
        return super().is_allowed_origin(origin)

app.add_middleware(
    RegexCORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 顯式白名單
    allow_credentials=True,
)
```

這樣可以：

- ✅ 支援 Cloudflare Pages 的動態預覽域名
- ✅ 不需要每次部署都更新後端配置
- ✅ 仍然保持安全性（只允許 .pages.dev）

---

#### 風險 4：冷啟動 UX 優化不足 ⚠️

**改進建議：**

```typescript
const startDebate = async () => {
  const startTime = Date.now();
  setStatus("正在連接 AI 引擎...");

  // ✅ 加入超時保護
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超時

  try {
    const response = await fetch(API_URL + "/debate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, max_rounds: 3 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const coldStartTime = Date.now() - startTime;

    // ✅ 改進：根據等待時間顯示不同訊息
    if (coldStartTime > 5000) {
      setStatus(`引擎已就緒（啟動耗時 ${(coldStartTime / 1000).toFixed(1)}s）`);
    } else if (coldStartTime > 2000) {
      setStatus("引擎預熱完成，開始辯論！");
    } else {
      setStatus("辯論進行中...");
    }

    // 讀取串流...
  } catch (error) {
    // ✅ 改進：更友善的錯誤訊息
    if (error.name === "AbortError") {
      setStatus("連接超時，引擎可能正在冷啟動。請稍後重試。");
    } else {
      setStatus(`錯誤：${error.message}`);
    }
  }
};
```

---

### 📋 修正後的可行性評分

| 項目       | 原評分 | 修正後評分 | 變更原因                                         |
| ---------- | ------ | ---------- | ------------------------------------------------ |
| 技術選型   | 9/10   | 9/10       | LangGraph、uv、Groq 都驗證正確 ✅                |
| 架構設計   | 9/10   | 8/10       | SSE + Cloudflare 有風險，需調整實作方式 ⚠️       |
| 成本控制   | 10/10  | 9/10       | 需加限流保護，避免 API 超額 ⚠️                   |
| 開發時程   | 8/10   | 7/10       | 建議從 4 週延長到 5 週（Phase 1 需先驗證 SSE）⚠️ |
| 文件完整度 | 9/10   | 9/10       | 非常詳細，但幾處技術細節需修正 ⚠️                |

**最終評分：8.5/10** (從 9/10 微調，因為發現 Cloudflare + SSE 與 async 實作的潛在風險)

---

### 🎯 必須執行的修正清單

#### 🔴 高優先級（Phase 0-1 必做）

1. **採用統一的 POST + Stream 方案**

   - 從 Phase 1 就使用 POST + fetch + ReadableStream
   - 放棄 GET + EventSource（僅用於概念測試）

2. **實作 Regex CORS Middleware**

   - 支援 Cloudflare Pages 動態域名
   - 避免每次部署都要更新後端配置

3. **所有 LangGraph 節點改為 async**

   - 使用 `async def` 定義節點函數
   - 所有 LLM 調用使用 `await llm.ainvoke(...)`

4. **Phase 1 關鍵驗證點**
   - **必須先確認 Cloudflare Pages 能正確處理 SSE 串流**
   - 如果有問題，立即準備 WebSocket 備案

#### 🟡 中優先級（Phase 2 完成前）

5. **加入後端限流保護**

   - 每 IP 每小時限制 10 次請求
   - 避免 Groq API 超額

6. **優化冷啟動 UX**

   - 顯示實際等待時間
   - 加入 30 秒超時保護
   - 提供友善的錯誤訊息

7. **加入基本測試**
   - 測試完整辯論流程
   - 測試工具調用機制

#### 🟢 低優先級（Phase 3+）

8. 環境變數範本化
9. 加入使用量監控
10. 實作 Keep-Alive 腳本（Demo 用）

---

### 📚 參考資料（已驗證）

**LangGraph & Streaming:**

- [LangGraph 1.0 Release Notes](https://docs.langchain.com/oss/python/releases/langgraph-v1)
- [LangGraph Streaming Documentation](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph GitHub Discussion #533](https://github.com/langchain-ai/langgraph/discussions/533)

**Python Tooling:**

- [uv vs pip - Real Python](https://realpython.com/uv-vs-pip/)
- [Python UV Guide - DataCamp](https://www.datacamp.com/tutorial/python-uv)
- [uv GitHub Repository](https://github.com/astral-sh/uv)

**API Services:**

- [Groq Rate Limits Documentation](https://console.groq.com/docs/rate-limits)
- [Groq Pricing](https://groq.com/pricing)
- [Tavily Official Website](https://www.tavily.com/)
- [Best SERP API Comparison 2025](https://dev.to/ritzaco/best-serp-api-comparison-2025-serpapi-vs-exa-vs-tavily-vs-scrapingdog-vs-scrapingbee-2jci)

**Deployment:**

- [Cloudflare Pages Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
- [EventSource with Cloudflare - Stack Overflow](https://stackoverflow.com/questions/78745060/how-to-make-the-event-stream-eventsource-working-with-cloudflare)
- [Server-Sent Events Implementation Guide](https://dev.to/serifcolakel/real-time-data-streaming-with-server-sent-events-sse-1gb2)

---

## 關鍵技術決策

### 1. 使用 uv 全家桶

**為什麼選擇 uv？**

- 比 pip 快 10-100 倍
- 內建依賴鎖定（uv.lock）
- 統一的工具鏈（取代 pip、pip-tools、virtualenv）
- 官方 Docker 映像支援

**安裝 uv:**

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 或使用 pip
pip install uv
```

### 2. 搜尋工具策略：Tavily 優先 + DuckDuckGo 備援

**問題：** DuckDuckGo 不穩定（基於爬蟲，常被擋 IP）

**解決方案：** 三層容錯機制

1. **主要策略**: 使用 Tavily（專為 AI 設計，極度穩定）
2. **備援策略**: Tavily 失敗時自動切換到 DuckDuckGo Text Search
3. **優雅降級**: 兩者都失敗時，基於已知知識回答（不會崩潰）

**好處：**

- Demo 永遠不會在面試官面前崩潰
- Tavily 1000 次/月免費額度足夠展示
- DuckDuckGo 作為無限次數備援

**⚠️ 架構決策：為什麼不使用 Playwright 爬蟲？**

**情境 A：即時辯論（本專案）**

- **推薦組合**：LangGraph + Tavily API + DDGS Text Search
- **理由**：
  - Tavily 已在伺服器端完成爬取與內容清洗，回傳純文字摘要
  - 回應速度 < 1 秒，適合「你來我往」的辯論節奏
  - Cloud Run 部署簡單，記憶體需求低（512MB 足夠）
  - 符合零成本策略
- **適用場景**：90% 的辯論資訊補充需求

**情境 B：深度研究（Phase 4 進階擴展）**

- **推薦組合**：LangGraph + DDGS + Playwright 爬蟲
- **理由**：
  - 需要繞過付費牆、操作網頁互動、或爬取動態渲染的 SPA
  - Tavily 無法覆蓋的冷門網站或特定內容
  - 完全自主控制爬取邏輯與資料清洗
- **部署要求**：
  - **不適合** Cloud Run（容器啟動慢、記憶體不足）
  - **推薦** Cloud Functions Gen2（2GB 記憶體）或獨立 VPS
  - 需要額外配置 Chromium 依賴與系統庫
- **適用場景**：特定的深度內容分析任務

**本專案選擇**：採用情境 A（Tavily + DDGS），Phase 4 可選擇性加入情境 B 作為「深度查證」功能

### 3. Cloud Run 冷啟動優化

**問題：** 最小實例設為 0 會導致 15 分鐘後冷啟動（10-15 秒延遲）

**解決方案：**

#### 方案 A: 前端 UX 優化（零成本，必做）

在前端顯示「正在喚醒 AI 引擎...」提示，讓使用者有心理準備

#### 方案 B: Keep-Alive 腳本（Demo 當天使用）

Demo 前 30 分鐘執行腳本，每 5 分鐘 ping 一次保持溫熱

#### 方案 C: 最小實例 = 1（約 $5-10/月）

僅在重要展示期間啟用

---

## 開發時程

### Week 1: 基礎建設 + 學習期

- **Day 1-2**: Phase 0 - 專案結構建立、環境配置、GCP/Cloudflare 帳號設定
- **Day 3-4**: Phase 1 - 實現基礎 SSE 串流（本地 + 雲端部署）
- **Day 5-7**: 學習 LangGraph，閱讀文檔，嘗試簡單範例

### Week 2: 核心功能開發

- **Day 8-10**: Phase 2 - 實現雙 Agent 辯論（Optimist + Skeptic）
- **Day 11-12**: 優化串流體驗，處理錯誤情況
- **Day 13-14**: 前端 UI 美化，加入動畫效果

### Week 3: 進階功能

- **Day 15-17**: Phase 3 - 整合搜尋工具（Tavily + DuckDuckGo）
- **Day 18-19**: 實現 Moderator 總結功能
- **Day 20-21**: 測試與 bug 修復

### Week 4: 完善與擴展

- **Day 22-24**: 追加功能（主題模板、對話歷史等）
- **Day 25-27**: 文檔撰寫、部署優化
- **Day 28-30**: 最終測試、準備展示材料

> ⚠️ **戰略警語：Phase 1-3 只用文字搜尋**  
> 保持辯論 <1 秒啟動的節奏：Tavily（主）+ DuckDuckGo Text（備）即可，不要把 Playwright 塞進主 API。若需深度爬取，放到 Phase 4，並獨立成 Cloud Functions/獨立容器供主流程呼叫。

---

## Phase 0: 專案初始化

### 目標

建立完整的專案骨架，配置所有必要的環境

### 後端設置

#### 1. 建立目錄結構

```bash
mkdir -p backend/app/{agents,tools}
cd backend
```

#### 2. 創建 `pyproject.toml`

```toml
[project]
name = "debate-ai-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "langchain>=0.3.0",
    "langchain-groq>=0.2.0",
    "langgraph>=1.0.0",  # ✅ 使用 LangGraph 1.0
    "tavily-python>=0.5.0",
    "duckduckgo-search>=6.0.0",
    "python-dotenv>=1.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

#### 3. 安裝依賴

```bash
# 使用 uv 安裝依賴
uv sync

# 或使用 uv pip
uv pip install -e .
```

#### 4. 創建 `.env.example`

```bash
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
ENVIRONMENT=development
```

#### 5. 創建 `Dockerfile`

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# 複製專案檔案
COPY pyproject.toml .
COPY uv.lock* .

# 安裝依賴
RUN uv sync --frozen --no-dev

# 複製應用程式碼
COPY . .

# 暴露端口
EXPOSE 8080

# 啟動應用
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### 6. 創建 `app/main.py` 骨架

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="DebateAI API")

# ⚠️ CORS 不支援通配符，從環境變數讀取實際域名
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

@app.get("/health")
async def health():
    return {"status": "ok", "message": "DebateAI API is running"}
```

#### 7. 測試後端

```bash
# 使用 uv 運行
uv run uvicorn app.main:app --reload --port 8000

# 測試 health endpoint
curl http://localhost:8000/health
```

### 前端設置

#### 1. 建立 Next.js 專案

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir
cd frontend
```

#### 2. 創建 `.env.local.example`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3. 配置 `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // 靜態導出，適合 Cloudflare Pages
};

module.exports = nextConfig;
```

#### 4. 測試前端

```bash
npm run dev
# 訪問 http://localhost:3000
```

### 部署準備

#### 1. Google Cloud Platform

```bash
# 安裝 gcloud CLI
# https://cloud.google.com/sdk/docs/install

# 初始化
gcloud init

# 建立專案
gcloud projects create debate-ai-demo --name="DebateAI"

# 設定專案
gcloud config set project debate-ai-demo

# 啟用 Cloud Run API
gcloud services enable run.googleapis.com
```

#### 2. Cloudflare 帳號

- 註冊 Cloudflare 帳號：https://dash.cloudflare.com/sign-up
- 安裝 Wrangler CLI：`npm install -g wrangler`

#### 3. API Keys

- **Groq**: https://console.groq.com/keys
- **Tavily**: https://app.tavily.com/

---

## Phase 1: 基礎架構連通

### 目標

實現最簡單的 SSE 串流，確認前後端通訊正常

**⚠️ 重要變更（基於 2025-12-03 驗證）：** 從 Phase 1 開始就使用 **POST + fetch + ReadableStream**，不再使用 GET + EventSource（避免 Cloudflare 相容性問題）。

### 後端實作

更新 `backend/app/main.py`（**採用修正後的最佳實踐**）:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import re
import os

app = FastAPI(title="DebateAI API")

# ✅ 修正：使用 Regex CORS 支援動態域名
class RegexCORSMiddleware(CORSMiddleware):
    def is_allowed_origin(self, origin: str) -> bool:
        # 允許 localhost 或任何 .pages.dev 結尾的域名
        if origin.startswith("http://localhost") or re.match(r"https://.*\.pages\.dev$", origin):
            return True
        return super().is_allowed_origin(origin)

app.add_middleware(
    RegexCORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 顯式白名單
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

class DebateRequest(BaseModel):
    topic: str
    max_rounds: int = 3

async def fake_stream(topic: str):
    """✅ Phase 1 測試：使用 JSON 格式的 SSE"""
    yield f"data: {json.dumps({'type': 'status', 'text': '🔥 引擎啟動中...'})}\n\n"
    await asyncio.sleep(0.5)

    words = ["Hello", " ", "World", "!", " ", "主題是：", topic]
    for word in words:
        yield f"data: {json.dumps({'type': 'token', 'node': 'test', 'text': word})}\n\n"
        await asyncio.sleep(0.3)

    yield f"data: {json.dumps({'type': 'complete'})}\n\n"

@app.post("/debate")
async def start_debate(req: DebateRequest):
    """✅ Phase 1 測試接口（POST + SSE）"""
    return StreamingResponse(
        fake_stream(req.topic),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # ⚠️ 關鍵：防止 Cloudflare 緩衝
        }
    )

@app.get("/health")
async def health():
    return {"status": "ok", "message": "DebateAI API is running"}
```

### 前端實作

創建 `frontend/app/page.tsx`（**採用修正後的 fetch + ReadableStream**）:

```typescript
"use client";

import { useState } from "react";

export default function Home() {
  const [topic, setTopic] = useState("AI will replace most human jobs");
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("");

  const startStream = async () => {
    setIsStreaming(true);
    setMessage("");
    setStatus("正在連接 AI 引擎...");

    const startTime = Date.now();

    // ✅ 加入超時保護
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // ✅ 使用 POST + fetch（不用 EventSource）
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/debate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, max_rounds: 1 }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const coldStartTime = Date.now() - startTime;
      if (coldStartTime > 3000) {
        setStatus(
          `引擎已就緒（啟動耗時 ${(coldStartTime / 1000).toFixed(1)}s）`
        );
      } else {
        setStatus("串流中...");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "status") {
                setStatus(data.text);
              } else if (data.type === "token") {
                setMessage((prev) => prev + data.text);
              } else if (data.type === "complete") {
                setStatus("✅ 完成！");
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("❌ 連接超時，請重試");
      } else {
        setStatus(`❌ 錯誤：${error.message}`);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">
          🎭 DebateAI - Phase 1
        </h1>
        <p className="text-gray-600 text-center mb-8">測試 SSE 串流連通性</p>

        <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            測試主題
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          />
          <button
            onClick={startStream}
            disabled={isStreaming}
            className="mt-4 w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? status : "開始測試串流"}
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="font-bold mb-4 text-gray-800">串流輸出：</h2>
          <div className="p-4 bg-gray-50 rounded border border-gray-200 min-h-[100px]">
            <p className="font-mono text-sm whitespace-pre-wrap">
              {message || "等待串流..."}
            </p>
          </div>
          {status && (
            <p className="mt-4 text-sm text-gray-600">狀態：{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 本地測試

```bash
# 終端 1: 啟動後端
cd backend
uv run uvicorn app.main:app --reload --port 8000

# 終端 2: 啟動前端
cd frontend
npm run dev
```

訪問 http://localhost:3000，點擊 "Start Stream"，應該看到 "Hello World! SSE is working!" 逐字顯示。

### 部署到雲端

#### 部署後端到 Cloud Run

```bash
cd backend

# 部署（私有模式，不公開）
gcloud run deploy debate-api \
  --source . \
  --region asia-east1 \
  --set-env-vars ENVIRONMENT=production,API_SECRET_KEY=your-secret-key-here \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10
  # ⚠️ 注意：沒有 --allow-unauthenticated，保持私有

# 取得服務 URL
gcloud run services describe debate-api --region asia-east1 --format 'value(status.url)'
# 輸出例如：https://debate-api-xxxxx-as.a.run.app

# ⚠️ 前端存取策略（二選一）：
# 1. 使用 Cloudflare Workers 代理（推薦，見 README.md）
# 2. 前端加入 Authorization: Bearer your-secret-key-here header
```

#### 部署前端到 Cloudflare Pages

```bash
cd frontend

# 更新 .env.local
NEXT_PUBLIC_API_URL=https://debate-api-xxxxx-as.a.run.app

# 構建
npm run build

# 部署（首次會要求登入）
npx wrangler pages deploy out --project-name debate-ai
```

### 驗收標準

- ✅ 瀏覽器可以看到 "Hello World! SSE is working!" 逐字顯示
- ✅ 本地和雲端都能正常運行
- ✅ 無 CORS 錯誤

---

## Phase 2: 接入 LangGraph 與 Groq

### 目標

實現真正的 AI 辯論

**重要變更：** 從此階段開始改用 **POST + fetch + ReadableStream** 取代 Phase 1 的 GET + EventSource，因為需要傳送辯論主題等參數

### 後端實作

#### 1. 創建 `backend/app/graph.py`

```python
from typing import TypedDict, Literal, List, Annotated
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END, add_messages
import os

class DebateState(TypedDict):
    """辯論狀態"""
    # 使用 add_messages 註解，讓 LangGraph 自動處理訊息累積
    messages: Annotated[List[BaseMessage], add_messages]
    topic: str
    current_speaker: Literal["optimist", "skeptic", "end"]
    round_count: int
    max_rounds: int

# 初始化 Groq LLM - 必須啟用 streaming
llm = ChatGroq(
    model="llama-3.1-70b-versatile",
    temperature=0.7,
    api_key=os.getenv("GROQ_API_KEY"),
    streaming=True  # ⚠️ 關鍵：必須啟用 streaming
)

# ✅ 修正：使用 async 函數 + ainvoke
async def optimist_node(state: DebateState) -> dict:
    """樂觀者 Agent（異步版本）"""
    # 構建訊息列表（LangChain 標準格式）
    messages = [
        HumanMessage(content=f"""你是一位樂觀的辯手。主題：{state['topic']}

請從積極的角度論述，強調優點、機會和可能性。保持簡潔（2-3 句話）。

之前的對話：
{format_messages(state['messages'][-4:])}""")
    ]

    # ⚠️ 關鍵：使用 ainvoke 而非 invoke
    # 這樣才能讓 astream_events 正確攔截串流事件
    response = await llm.ainvoke(messages)

    return {
        "messages": [AIMessage(content=response.content, name="optimist")],
        "current_speaker": "skeptic",
    }

async def skeptic_node(state: DebateState) -> dict:
    """懷疑者 Agent（異步版本）"""
    messages = [
        HumanMessage(content=f"""你是一位理性的懷疑者。主題：{state['topic']}

請從批判的角度論述，指出風險、問題和挑戰。保持簡潔（2-3 句話）。

之前的對話：
{format_messages(state['messages'][-4:])}""")
    ]

    # ⚠️ 關鍵：使用 ainvoke
    response = await llm.ainvoke(messages)

    new_round = state["round_count"] + 1
    next_speaker = "end" if new_round >= state["max_rounds"] else "optimist"

    return {
        "messages": [AIMessage(content=response.content, name="skeptic")],
        "current_speaker": next_speaker,
        "round_count": new_round
    }

def format_messages(messages: List[BaseMessage]) -> str:
    """格式化訊息歷史"""
    return "\n".join([
        f"{getattr(m, 'name', 'unknown')}: {m.content}"
        for m in messages
        if hasattr(m, 'content') and m.content
    ])

def should_continue(state: DebateState) -> str:
    """決定下一個節點"""
    return state["current_speaker"]

# 建立 StateGraph
graph = StateGraph(DebateState)
graph.add_node("optimist", optimist_node)
graph.add_node("skeptic", skeptic_node)

# 設定入口點
graph.set_conditional_entry_point(
    should_continue,
    {
        "optimist": "optimist",
        "skeptic": "skeptic",
        "end": END
    }
)

# 設定邊
graph.add_conditional_edges(
    "optimist",
    should_continue,
    {
        "skeptic": "skeptic",
        "end": END
    }
)

graph.add_conditional_edges(
    "skeptic",
    should_continue,
    {
        "optimist": "optimist",
        "end": END
    }
)

# 編譯
debate_graph = graph.compile()
```

**⚠️ 重要說明：LangGraph 1.0 串流機制**

1. **新的串流 API：**

   - LangGraph 1.0 使用 `astream()` + `stream_mode="messages"` 取代舊的 `astream_events()`
   - API 更簡潔直觀，不需要複雜的事件過濾
   - 節點資訊直接從 metadata 的 `langgraph_node` 欄位獲取

2. **關鍵配置：**

   - LLM 必須設定 `streaming=True`
   - 使用 `async for message, metadata in graph.astream(state, stream_mode="messages")`
   - 可使用多種 stream_mode: `"messages"`, `"values"`, `"updates"`, `"debug"`
   - 支援多模式串流：`stream_mode=["messages", "updates"]`

3. **工具調用監聽：**
   - Token 串流使用 `stream_mode="messages"`
   - 工具調用監聽使用 `stream_mode="updates"` 或組合使用
   - 可以過濾特定節點：檢查 `metadata["langgraph_node"]`

#### 2. 更新 `backend/app/main.py`

```python
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.graph import debate_graph, DebateState
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DebateAI API", version="0.1.0")

# CORS 配置 - 從環境變數讀取允許的來源
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ⚠️ 必須填入實際域名，不支援 * 通配
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# 簡單的 API Key 驗證（可選）
API_SECRET_KEY = os.getenv("API_SECRET_KEY")

def verify_api_key(authorization: str = Header(None)):
    """驗證 API Key（如需私有部署）"""
    if not API_SECRET_KEY:
        return  # 未設定則跳過驗證

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ")[1]
    if token != API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

class DebateRequest(BaseModel):
    topic: str
    max_rounds: int = 3

async def debate_stream(topic: str, max_rounds: int):
    """串流 AI 辯論"""
    initial_state: DebateState = {
        "messages": [],
        "topic": topic,
        "current_speaker": "optimist",
        "round_count": 0,
        "max_rounds": max_rounds
    }

    # ✅ LangGraph 1.0：使用 astream() + stream_mode="messages"
    async for message, metadata in debate_graph.astream(
        initial_state,
        stream_mode="messages"
    ):
        # 監聽 LLM token 串流
        if hasattr(message, 'content') and message.content:
            # 從 metadata 獲取節點資訊
            node = metadata.get("langgraph_node", "unknown")

            data = {
                "type": "token",
                "node": node,
                "text": message.content
            }
            yield f"data: {json.dumps(data)}\n\n"

    # ⚠️ 注意：工具調用事件需要使用額外的 stream_mode
    # 如需監聽工具調用，使用 stream_mode=["messages", "updates"]
    # 然後根據事件類型分別處理：
    # - "messages" mode: 包含 LLM token
    # - "updates" mode: 包含節點狀態更新（可檢測工具調用）

    # 發送完成事件
    yield f"data: {json.dumps({'type': 'complete'})}\n\n"

@app.post("/debate")
async def start_debate(
    request: DebateRequest,
    authorization: str = Header(None)
):
    """開始 AI 辯論（POST + SSE 串流）"""
    # 驗證 API Key（如有設定）
    if API_SECRET_KEY:
        verify_api_key(authorization)

    return StreamingResponse(
        debate_stream(request.topic, request.max_rounds),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁用 nginx 緩衝
        }
    )

@app.get("/health")
async def health():
    """健康檢查"""
    return {
        "status": "ok",
        "version": "0.1.0",
        "has_groq_key": bool(os.getenv("GROQ_API_KEY")),
        "has_tavily_key": bool(os.getenv("TAVILY_API_KEY"))
    }
```

**⚠️ 關鍵修正（LangGraph 1.0）：**

1. **使用新的串流 API**：

   - 使用 `astream()` + `stream_mode="messages"` 取代 `astream_events()`
   - 節點資訊從 `metadata["langgraph_node"]` 獲取，不再需要解析 tags

2. **CORS 配置**：

   - 不支援 `*.pages.dev` 通配符
   - 必須填入實際完整域名
   - 建議從環境變數 `ALLOWED_ORIGINS` 讀取

3. **SSE 標頭**：

   - `Cache-Control: no-cache` 防止快取
   - `X-Accel-Buffering: no` 防止 nginx 緩衝

4. **API Key 驗證**（可選）：
   - 如不想公開 API，設定 `API_SECRET_KEY` 環境變數
   - 前端需在 header 加入 `Authorization: Bearer {key}`

### 前端實作

更新 `frontend/app/page.tsx`:

```typescript
"use client";

import { useState } from "react";

export default function Home() {
  const [topic, setTopic] = useState("AI will replace most human jobs");
  const [optimistText, setOptimistText] = useState("");
  const [skepticText, setSkepticText] = useState("");
  const [isDebating, setIsDebating] = useState(false);
  const [status, setStatus] = useState("");

  const startDebate = async () => {
    setIsDebating(true);
    setOptimistText("");
    setSkepticText("");
    setStatus("正在喚醒 AI 引擎...");

    const startTime = Date.now();

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/debate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, max_rounds: 3 }),
        }
      );

      const coldStartTime = Date.now() - startTime;
      if (coldStartTime > 3000) {
        setStatus("引擎已就緒，開始辯論！");
      } else {
        setStatus("辯論進行中...");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "token") {
                if (data.node === "optimist") {
                  setOptimistText((prev) => prev + data.text);
                } else if (data.node === "skeptic") {
                  setSkepticText((prev) => prev + data.text);
                }
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      setStatus("辯論完成！");
    } catch (error) {
      setStatus("錯誤：" + (error as Error).message);
    } finally {
      setIsDebating(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">🎭 DebateAI</h1>
        <p className="text-gray-600 text-center mb-8">
          Multi-Agent AI Debate Platform
        </p>

        <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            辯論主題
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="輸入辯論主題..."
            disabled={isDebating}
          />
          <button
            onClick={startDebate}
            disabled={isDebating}
            className="mt-4 w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isDebating ? status : "開始辯論"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-green-50 p-6 rounded-lg shadow-md border-2 border-green-200">
            <h2 className="font-bold mb-4 text-green-800 flex items-center gap-2">
              <span className="text-2xl">😊</span>
              <span>Optimist</span>
            </h2>
            <div className="prose prose-sm">
              <p className="whitespace-pre-wrap text-gray-800">
                {optimistText || "等待發言..."}
              </p>
            </div>
          </div>
          <div className="bg-red-50 p-6 rounded-lg shadow-md border-2 border-red-200">
            <h2 className="font-bold mb-4 text-red-800 flex items-center gap-2">
              <span className="text-2xl">🤔</span>
              <span>Skeptic</span>
            </h2>
            <div className="prose prose-sm">
              <p className="whitespace-pre-wrap text-gray-800">
                {skepticText || "等待發言..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 環境變數設置

```bash
# backend/.env
GROQ_API_KEY=gsk_your_actual_key_here
ENVIRONMENT=development

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 測試

```bash
# 後端
cd backend
uv run uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm run dev
```

### 驗收標準

- ✅ 兩個 AI agent 能針對主題進行 3 回合辯論
- ✅ 文字以打字機效果即時顯示
- ✅ 左右兩側分別顯示樂觀者和懷疑者的論述
- ✅ 每個回應在 5 秒內開始輸出

---

## Phase 3: 工具調用與完善

### 目標

加入搜尋工具，讓 AI 能查證資料

### 後端實作

#### 1. 創建 `backend/app/tools.py`

```python
from langchain.tools import Tool
from tavily import TavilyClient
from duckduckgo_search import DDGS
import os

# 初始化 Tavily 客戶端
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY")) if os.getenv("TAVILY_API_KEY") else None

def web_search(query: str) -> str:
    """
    搜尋工具：Tavily (主) + DuckDuckGo (備援)

    三層容錯策略：
    1. 優先使用 Tavily（專為 AI 設計，極度穩定）
    2. Tavily 失敗時自動 fallback 到 DuckDuckGo
    3. 兩者都失敗時優雅降級，不會崩潰
    """

    # 策略 1: 優先使用 Tavily
    if tavily_client:
        try:
            response = tavily_client.search(query, max_results=3)
            if response.get("results"):
                formatted = "\n".join([
                    f"- {r['title']}: {r['content'][:150]}..."
                    for r in response["results"]
                ])
                return f"[Tavily] 搜尋結果：\n{formatted}"
        except Exception as tavily_error:
            print(f"Tavily failed: {tavily_error}, falling back to DuckDuckGo")

    # 策略 2: Fallback 到 DuckDuckGo
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            if results:
                formatted = "\n".join([
                    f"- {r['title']}: {r['body'][:150]}..."
                    for r in results
                ])
                return f"[DuckDuckGo] 搜尋結果：\n{formatted}"
    except Exception as ddg_error:
        print(f"DuckDuckGo failed: {ddg_error}")

    # 策略 3: 優雅降級
    return (
        f"[注意] 搜尋功能暫時無法使用，但我會根據已知知識回答關於「{query}」的問題。"
        "（此回答未經即時數據驗證）"
    )

# 創建 LangChain Tool
search_tool = Tool(
    name="web_search",
    description="Search the web for current information, statistics, facts, or recent news. Use this when you need to verify claims or get up-to-date data.",
    func=web_search
)
```

#### 2. 更新 `backend/app/graph.py`

在文件開頭加入：

```python
from app.tools import search_tool
```

修改 LLM 初始化部分：

```python
# 為 LLM 綁定工具
llm = ChatGroq(
    model="llama-3.1-70b-versatile",
    temperature=0.7,
    api_key=os.getenv("GROQ_API_KEY"),
    streaming=True
)

llm_with_tools = llm.bind_tools([search_tool])
```

修改 `optimist_node` 和 `skeptic_node`，使用 `llm_with_tools` 並處理工具調用：

```python
from langchain_core.messages import ToolMessage

def optimist_node(state: DebateState) -> dict:
    """樂觀者 Agent（支援工具調用）"""

    # 構建訊息鏈
    messages = [
        HumanMessage(content=f"""你是一位樂觀的辯手。主題：{state['topic']}

請從積極的角度論述，強調優點、機會和可能性。保持簡潔（2-3 句話）。

如果需要最新數據或事實支持，使用 web_search 工具查詢。

之前的對話：
{format_messages(state['messages'][-4:])}""")
    ]

    # 第一次調用（可能請求工具）
    response = llm_with_tools.invoke(messages)
    messages.append(response)

    # ⚠️ 關鍵：處理工具調用循環
    while response.tool_calls:
        for tool_call in response.tool_calls:
            # 執行工具
            result = search_tool.invoke(tool_call["args"])

            # ⚠️ 使用 ToolMessage 保持訊息鏈完整性
            messages.append(
                ToolMessage(
                    content=result,
                    tool_call_id=tool_call["id"],
                    name="web_search"
                )
            )

        # 用工具結果再次調用（仍會串流，因為 LangGraph 攔截）
        response = llm.invoke(messages)
        messages.append(response)

    return {
        "messages": state["messages"] + [AIMessage(content=response.content, name="optimist")],
        "current_speaker": "skeptic",
        "round_count": state["round_count"]
    }
```

對 `skeptic_node` 做類似修改（將 `name="optimist"` 改為 `name="skeptic"`，並調整 prompt）。

**⚠️ 為什麼這樣寫？**

1. **使用 ToolMessage**：保持 LangChain 訊息鏈的完整性，讓 LLM 知道工具調用的結果
2. **避免字串拼接**：不要用 `final_prompt = f"{prompt}\n\n搜尋結果：{result}"`，這會破壞工具調用的上下文
3. **仍然串流**：最後的 `llm.invoke(messages)` 仍會被 LangGraph 的 `astream_events` 攔截並串流輸出

### 前端更新

#### 1. 更新 SSE 事件處理

在前端加入工具調用狀態指示：

```typescript
const [isSearching, setIsSearching] = useState(false);
const [searchQuery, setSearchQuery] = useState("");

// 在 SSE 處理中檢測工具調用
if (data.type === "tool_start") {
  // 工具開始執行
  setSearchQuery(data.input.query || "Searching...");
  setIsSearching(true);
} else if (data.type === "tool_end") {
  // 工具執行完成
  setIsSearching(false);
} else if (data.type === "token") {
  // Token 串流（原有邏輯）
  // ...
}
```

#### 2. 更新 UI 顯示

在 UI 中顯示搜尋狀態：

```typescript
{
  isSearching && (
    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
      <svg className="animate-spin h-5 w-5 text-yellow-600" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-yellow-800">🔍 正在搜尋：{searchQuery}</span>
    </div>
  );
}
```

#### 3. 完整的 SSE 處理邏輯

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));

      switch (data.type) {
        case "token":
          // 更新對應 Agent 的文字
          updateAgentMessage(data.node, data.text);
          break;

        case "tool_start":
          // 顯示搜尋中
          setSearchQuery(data.input.query || "Searching...");
          setIsSearching(true);
          break;

        case "tool_end":
          // 隱藏搜尋指示器
          setIsSearching(false);
          break;

        case "node_end":
          // 節點完成（可選：顯示完成動畫）
          break;

        case "complete":
          // 辯論完成
          setStatus("completed");
          break;
      }
    }
  }
}
```

### 環境變數更新

```bash
# backend/.env
GROQ_API_KEY=gsk_your_key_here
TAVILY_API_KEY=tvly_your_key_here
ENVIRONMENT=development
```

### 驗收標準

- ✅ Agent 可以自主決定何時搜尋
- ✅ 搜尋結果影響辯論內容
- ✅ Tavily 失敗時自動切換到 DuckDuckGo
- ✅ 搜尋失敗時不會崩潰，優雅降級

---

## 關鍵技術要點

### 1. SSE 串流處理

#### 後端要點

- 使用 `StreamingResponse` 搭配 async generator
- 每個 chunk 必須是 `data: ...\n\n` 格式
- 處理 `astream_events` 的不同事件類型（v1 仍支援）
- 使用 LangGraph v1 穩定 API（graph/state/node 模型未變）

#### 前端要點

- 使用 `fetch` + `ReadableStream` 而非 `EventSource`（因為需要 POST）
- 正確解析 SSE 格式（處理 `data:` 前綴）
- 實作重連邏輯處理網路中斷

### 2. LangGraph 狀態管理

#### 核心概念

- `StateGraph` 定義狀態流轉
- 每個 node 返回 partial state（會自動 merge）
- `conditional_edges` 根據狀態決定下一步

#### 常見錯誤

- ❌ 忘記在 node 中返回 `current_speaker` 導致無限循環
- ❌ `messages` list 不斷累積導致 context 過長（建議只保留最近 4-6 條）
- ❌ 沒有設定 `max_rounds` 導致費用失控

### 3. CORS 配置

#### 必須設定

```python
allow_origins=["http://localhost:3000", "https://*.pages.dev"]
```

#### 常見問題

- ❌ 忘記加入實際的 Cloudflare Pages URL
- ❌ 只設定 `allow_origins=["*"]` 但 SSE 可能需要 credentials
- ✅ 本地和生產環境都要包含

### 4. Groq API 優化

#### 速度優化

- 使用 `llama-3.1-70b-versatile` 或 `llama-3.1-8b-instant`
- 設定合理的 `max_tokens`（避免過長回應）
- 使用 `temperature=0.7`（平衡創意和一致性）

#### 成本控制

- 每次辯論約使用 1500-2000 tokens
- Groq 免費額度通常足夠開發測試
- 設定 rate limiting（避免被濫用）

---

## 風險緩解策略

### 1. API 限流風險

**風險：** Groq 或 Tavily API 達到限額

**緩解措施：**

- 實作後端 rate limiting
- 準備多個 API key 輪替
- 加入使用量監控（可用 Redis 計數器）

### 2. Cloud Run 冷啟動

**風險：** 15 分鐘無請求後休眠，首次請求慢

**緩解措施：**

#### 方案 A: 前端 UX 優化（零成本）

```typescript
setStatus('正在喚醒 AI 引擎...');
const startTime = Date.now();
const response = await fetch(...);
const coldStartTime = Date.now() - startTime;

if (coldStartTime > 3000) {
  setStatus('引擎已就緒，開始辯論！');
}
```

#### 方案 B: Keep-Alive 腳本（Demo 使用）

```bash
#!/bin/bash
# keep-alive.sh
API_URL="https://your-api.a.run.app/health"

while true; do
  echo "$(date): Pinging $API_URL"
  curl -s $API_URL > /dev/null
  sleep 300  # 每 5 分鐘 ping 一次
done
```

使用方式：

```bash
# Demo 前 30 分鐘執行
./keep-alive.sh &

# 記下 PID
echo $! > keep-alive.pid

# Demo 結束後停止
kill $(cat keep-alive.pid)
```

#### 方案 C: 最小實例 = 1（約 $5-10/月）

僅在重要展示期間啟用：

```bash
gcloud run services update debate-api --min-instances 1
```

### 3. SSE 連接穩定性

**風險：** 網路中斷或長時間無數據導致連接斷開

**緩解措施：**

- 前端實作自動重連機制
- 後端加入 keepalive ping（每 30 秒發送空數據）
- 設定合理的 timeout（建議 300 秒）

### 4. 搜尋工具不穩定

**風險：** DuckDuckGo 被封鎖或限流

**緩解措施：**

- ✅ 已實施：三層容錯策略（Tavily → DuckDuckGo → 優雅降級）
- Demo 永遠不會因為搜尋失敗而崩潰

---

## 零成本策略清單

為確保成本為 $0，嚴格遵守以下設定：

### Google Cloud Run

- ✅ 使用免費額度（200 萬次請求/月）
- ✅ 最小實例數設為 0（接受冷啟動）
- ✅ 內存限制 512MB（夠用且在免費範圍）
- ✅ CPU 限制 1 vCPU
- ✅ Timeout 設為 300 秒
- ❌ 不使用 Cloud SQL、Cloud Storage 等付費服務

### Cloudflare Pages

- ✅ 完全免費（無限請求）
- ✅ 自動 HTTPS
- ✅ 全球 CDN

### API Services

- ✅ Groq: 使用免費額度，設定 rate limiting
- ✅ Tavily: 1000 次/月免費
- ✅ DuckDuckGo: 完全免費

### 避免使用的付費服務

- ❌ Cloud SQL / Firebase
- ❌ Cloud Storage
- ❌ Cloud Logging（使用 stdout 即可）
- ❌ Cloud Run 最小實例 ≥ 1（會產生成本，除非 Demo 當天）

---

## 後續擴展功能（Week 4+）

根據測試結果，可選擇性加入：

### 🟢 基礎擴展（推薦優先）

1. **主題模板庫**: 預設 10 個熱門辯論主題
2. **對話歷史**: 使用 localStorage 儲存過往辯論
3. **Moderator 總結**: 第三個 agent 生成辯論總結
4. **分享功能**: 生成可分享的辯論記錄連結
5. **多語言支持**: 切換中英文介面
6. **深色模式**: UI 主題切換
7. **回合進度條**: 顯示當前辯論進度
8. **Export 功能**: 導出辯論記錄為 Markdown 或 PDF

### 🔵 進階擴展（需額外架構調整）

#### 9. **深度網頁爬取功能（Playwright Integration）**

**使用場景**：

- 分析特定長文報告（如學術論文、政府白皮書）
- 繞過需要 JavaScript 渲染的動態網站
- 爬取 Tavily 無法覆蓋的特殊內容

**架構設計**：

```
前端 (Cloudflare Pages)
    ↓
主 API (Cloud Run - 512MB)          ← 負責辯論 + Tavily 搜尋
    ↓
爬蟲服務 (Cloud Functions Gen2 - 2GB) ← 負責 Playwright 爬取
```

**部署步驟**：

1. **創建獨立的爬蟲服務**：

```bash
# 新建目錄
mkdir scraper-service
cd scraper-service

# pyproject.toml
[project]
dependencies = [
    "playwright>=1.40.0",
    "beautifulsoup4>=4.12.0",
    "functions-framework>=3.0.0"
]

# main.py
import functions_framework
from playwright.async_api import async_playwright

@functions_framework.http
async def scrape_webpage(request):
    url = request.json.get('url')
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(url)
        content = await page.content()
        await browser.close()
        # 清洗內容...
        return {'text': cleaned_text}
```

2. **部署到 Cloud Functions**：

```bash
gcloud functions deploy playwright-scraper \
  --gen2 \
  --runtime python311 \
  --memory 2048MB \
  --timeout 60s \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-east1
```

3. **主 API 調用爬蟲服務**：

```python
# backend/app/tools.py
import httpx

async def deep_scrape(url: str) -> str:
    """深度爬取特定網頁（非同步調用）"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://asia-east1-xxx.cloudfunctions.net/playwright-scraper",
            json={"url": url},
            timeout=60.0
        )
        return response.json()['text']

# 在 web_search 中選擇性使用
async def web_search(query: str, deep_mode: bool = False) -> dict:
    # 第一層：Tavily（快速摘要）
    results = await tavily_search(query)

    # 如果使用者要求深度模式，且找到特定網址
    if deep_mode and results:
        top_url = results[0]['url']
        detailed_content = await deep_scrape(top_url)
        results[0]['detailed_content'] = detailed_content

    return results
```

**成本估算**：

- Cloud Functions Gen2（2GB）每月免費 200 萬次請求
- Playwright 啟動約 3-5 秒，單次爬取約 $0.0001
- 建議：只在使用者明確要求「深度分析」時啟用

**優點**：

- ✅ 不影響主 API 的輕量與速度
- ✅ 爬蟲失敗不會拖垮整個系統
- ✅ 可獨立擴展記憶體與超時設定

**缺點**：

- ⚠️ 增加架構複雜度
- ⚠️ 需要維護兩個服務
- ⚠️ 網路延遲（主 API ↔ 爬蟲服務）

**建議時機**：

- 在 Phase 1-3 完成後
- 當基礎辯論功能穩定運行
- 當你需要展示「深度研究能力」作為差異化功能

---

## 常見問題 (FAQ)

### Q: 為什麼選擇 uv 而不是 pip?

A: uv 比 pip 快 10-100 倍，內建依賴鎖定，是 Python 工具鏈的未來趨勢。

### Q: Tavily 和 DuckDuckGo 哪個更好？

A: Tavily 更穩定但有次數限制（1000 次/月），DuckDuckGo 免費但不穩定。我們採用 Tavily 優先 + DuckDuckGo 備援的策略。

### Q: 如何避免 Groq API 超額？

A: 在後端實作 rate limiting，監控使用量，必要時準備多個 API key 輪替。

### Q: Cloud Run 冷啟動太慢怎麼辦？

A: Demo 前使用 keep-alive 腳本保持溫熱，或在前端顯示「正在喚醒引擎」的友好提示。

### Q: 如何處理 CORS 錯誤？

A: 確保 FastAPI 的 `allow_origins` 包含前端的實際 URL（本地和生產環境）。

---

## 成功指標

### Phase 1 完成標準

- ✅ 可以從瀏覽器看到 "Hello World" 串流
- ✅ CORS 配置正確
- ✅ 前後端可在 localhost 和雲端環境運行

### Phase 2 完成標準

- ✅ 兩個 AI agent 可以就主題進行 3 回合辯論
- ✅ 對話以打字機效果即時顯示
- ✅ 無明顯卡頓（每個回應 < 5 秒開始輸出）

### Phase 3 完成標準

- ✅ Agent 可以自主決定何時搜尋
- ✅ 搜尋結果影響辯論內容
- ✅ 搜尋失敗時優雅降級
- ✅ Moderator 可以生成有意義的總結

---

## 結論

這是一個**高度可行**的專案（9/10），技術選型合理，架構設計清晰。

**關鍵成功因素:**

1. ✅ 使用現代化工具鏈（uv）
2. ✅ 採用 LangGraph v1 穩定 API
3. ✅ 三層容錯的搜尋策略
4. ✅ 冷啟動 UX 優化
5. ✅ 嚴格遵守零成本策略
6. ✅ 漸進式開發（每個 Phase 都有可展示成果）

**專案完成後你將獲得:**

- 完整的 Multi-Agent AI 應用作品
- FastAPI + LangGraph + Next.js 實戰經驗
- SSE 串流技術掌握
- 雲端部署（GCP + Cloudflare）經驗
- 現代化 Python 工具鏈（uv）使用經驗
- 一個可放入作品集的完整專案

**準備好開始了嗎？** 從 Phase 0 開始，先建立專案結構！

---

## 參考資料

- [LangGraph 官方文檔](https://langchain-ai.github.io/langgraph/)
- [uv 官方文檔](https://docs.astral.sh/uv/)
- [FastAPI 官方文檔](https://fastapi.tiangolo.com/)
- [Groq API 文檔](https://console.groq.com/docs)
- [Tavily API 文檔](https://docs.tavily.com/)
- [Google Cloud Run 文檔](https://cloud.google.com/run/docs)
- [Cloudflare Pages 文檔](https://developers.cloudflare.com/pages/)
