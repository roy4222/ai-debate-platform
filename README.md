# 🚀 專案計畫書：DebateAI

## 多 Agent 即時辯論與協作平台

---

## 📋 目錄

1. [專案概述](#1-專案概述)
2. [系統架構設計](#2-系統架構設計)
3. [功能詳細規格](#3-功能詳細規格)
4. [開發階段規劃](#4-開發階段規劃)
5. [部署與配置清單](#5-部署與配置清單)
6. [預期成果](#6-預期成果)
7. [實施狀態](#7-實施狀態)

---

## 1. 專案概述

### 1.1 專案簡介

**DebateAI** 是一個基於 **LangGraph** 的多 Agent 協作平台，展示 AI 如何針對特定主題進行結構化的辯論與事實查核。

### 1.2 核心特色

- ✅ **複雜的 Agent 狀態管理**
- ✅ **工具調用 (Tool Use)**
- ✅ **即時串流 (Streaming)**
- ✅ **全端開發整合**

### 1.3 核心價值

證明開發者具備以下能力：
- **Python (LangGraph/FastAPI)** 後端開發
- **Modern Frontend (Next.js)** 前端開發
- **LLM 推理速度優化 (Groq)** 實戰經驗

---

## 2. 系統架構設計

### 2.1 架構概述

採用 **前後端分離 (Decoupled Architecture)**，確保最佳的互動體驗與後端邏輯的可擴展性。

### 2.2 技術堆疊 (Tech Stack)

| 領域 | 技術選型 | 詳細說明 / 部署策略 |
|:---|:---|:---|
| **Python 工具鏈** | **uv** | • 現代化依賴管理（比 pip 快 10-100 倍）<br>• 內建依賴鎖定（uv.lock）<br>• 統一工具鏈 |
| **前端 Framework** | **Next.js 14+** | • 使用 App Router<br>• 部署於 **Cloudflare Pages**<br>• 使用 `output: 'export'` 靜態導出<br>• Phase 1 用 `EventSource` (GET)<br>• Phase 2+ 用 `fetch + ReadableStream` (POST) |
| **後端 Framework** | **FastAPI** | • Python 3.11+<br>• 部署於 **Google Cloud Run** (Docker Container)<br>• 使用 **uv** 管理依賴<br>• 提供 SSE 串流接口（私有部署） |
| **AI 框架** | **LangGraph 0.2+** | • 最新版本的 multi-agent 框架<br>• 使用 `astream_events` API<br>• 原生支援工具調用與串流 |
| **LLM 核心** | **Groq** | • Llama-3.1-70b 模型<br>• 利用 Groq 的 LPU 提供每秒 300+ token 的超快推理<br>• 使用 streaming 模式實現打字機效果 |
| **搜尋工具** | **Tavily + DuckDuckGo** | • **Tavily**：專為 AI 設計，極度穩定（1000 次/月免費）<br>• **DuckDuckGo**：備援方案，完全免費<br>• **三層容錯**：Tavily → DuckDuckGo → 優雅降級 |
| **通訊協定** | **HTTP + SSE** | • Phase 1: GET + EventSource (簡單測試)<br>• Phase 2+: POST + fetch + ReadableStream (完整功能) |

### 2.3 架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                     使用者瀏覽器                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Next.js Frontend (Cloudflare Pages)           │  │
│  │  • React Components                                   │  │
│  │  • SSE Client (EventSource / fetch)                   │  │
│  │  • Real-time UI Updates                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS + SSE
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Google Cloud Run)             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  LangGraph Workflow                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Optimist   │  │  Skeptic    │  │  Moderator  │  │  │
│  │  │   Agent     │  │   Agent     │  │   (Phase 2) │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │         │                │                │          │  │
│  │         └────────────────┴────────────────┘          │  │
│  │                         │                            │  │
│  │                    StateGraph                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              External Services                        │  │
│  │  • Groq API (LLM)                                     │  │
│  │  • Tavily Search                                      │  │
│  │  • DuckDuckGo Search (Fallback)                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 功能詳細規格

### 3.1 LangGraph 流程設計

#### 3.1.1 狀態定義 (State Schema)

```python
from typing import Annotated, Literal, List, TypedDict
from langgraph.graph import add_messages
from langchain_core.messages import BaseMessage

class DebateState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]  # 自動累積訊息
    topic: str                                             # 辯論主題
    current_speaker: Literal["optimist", "skeptic", "end"] # 下一位發言者
    round_count: int                                       # 當前輪數
    max_rounds: int                                        # 最大輪數
```

#### 3.1.2 Agent 節點與角色

##### 1. Optimist (樂觀者)
- **職責**：從積極角度論述
- **工具**：若論點需要數據，自動調用 `web_search`
- **特色**：強調機會、優勢與正面影響

##### 2. Skeptic (懷疑者)
- **職責**：找出對方邏輯漏洞，強調風險
- **工具**：若發現對方數據可疑，調用 `web_search` 進行查核
- **特色**：批判性思考、風險評估

##### 3. Moderator (主持人 - Phase 2)
- **職責**：當 `round_count` 達到上限時觸發
- **功能**：閱讀歷史並生成總結報告
- **輸出**：平衡的結論與關鍵洞察

### 3.2 即時串流機制

#### 3.2.1 技術實現

**為什麼需要串流？**
解決 LLM 響應延遲的問題，提供更好的用戶體驗。

**實現方式：**

1. **Backend (LangGraph)**
   ```python
   # 使用 astream_events(version="v2")
   async for event in graph.astream_events(state, version="v2"):
       if event["event"] == "on_chat_model_stream":
           # 捕捉每個 token
           token = event["data"]["chunk"].content
           node = event["tags"][0]  # v2 從 tags 獲取節點資訊
           yield {"node": node, "text": token}
   ```

2. **Transport (SSE)**
   ```python
   # FastAPI SSE 格式
   async def stream_debate():
       async for chunk in langraph_stream():
           yield f"data: {json.dumps(chunk)}\n\n"
   ```

3. **Frontend (React)**
   ```typescript
   // EventSource 連接
   const eventSource = new EventSource('/api/debate/stream');
   eventSource.onmessage = (event) => {
       const data = JSON.parse(event.data);
       // 根據 node 渲染到對應位置
       updateUI(data.node, data.text);
   };
   ```

#### 3.2.2 用戶體驗

- ✅ **打字機效果**：逐字顯示，提升互動感
- ✅ **即時反饋**：無需等待完整回應
- ✅ **角色區分**：不同 Agent 顯示在不同區域
- ✅ **狀態指示**：顯示「正在思考...」、「正在搜尋...」

---

## 4. 開發階段規劃

### 🔴 Phase 1: 基礎架構連通

**目標**：確保 Cloudflare 前端能連上 Cloud Run 後端，並看到字在動。

#### 後端任務
- [ ] 建立 FastAPI 專案，撰寫 `Dockerfile`（使用 uv）
- [ ] 實作 Fake SSE 接口（每秒回傳 "Hello" → "World"）
- [ ] 配置 `CORSMiddleware`（從環境變數 `ALLOWED_ORIGINS` 讀取）
- [ ] 部署至 **Google Cloud Run**（私有模式，使用 API Key 驗證）

#### 前端任務
- [ ] 建立 Next.js 介面
- [ ] 使用 `EventSource` 連接後端 URL
- [ ] 部署至 **Cloudflare Pages**
- [ ] 記下實際 URL 並更新後端 CORS 配置

#### 驗收標準
✅ 前端能看到後端推送的測試訊息
✅ CORS 配置正確，無跨域錯誤
✅ 部署環境正常運作

---

### 🟡 Phase 2: 接入 LangGraph 與 Groq

**目標**：真正的 AI 辯論，Agent 能夠針對主題對話。

#### 後端任務
- [ ] 申請 **Groq API Key** 並寫入 Cloud Run 環境變數
- [ ] 實作 `Optimist` 與 `Skeptic` 的 LangGraph 節點
- [ ] 將 `astream_events` 串接到 FastAPI 的 `StreamingResponse`
- [ ] 實作狀態管理邏輯（輪次控制、發言順序）

#### 前端任務
- [ ] 優化 UI，根據 Agent 角色顯示不同顏色的對話氣泡
- [ ] 實作主題輸入表單
- [ ] 添加輪次設定功能
- [ ] 實作載入狀態與錯誤處理

#### 驗收標準
✅ 輸入主題後，兩個 Agent 開始辯論
✅ 即時串流顯示正常
✅ 辯論能自動結束

---

### 🟢 Phase 3: 工具調用與完善

**目標**：加入聯網能力，讓辯論言之有物。

#### 後端任務
- [ ] 整合 **Tavily（主）+ DuckDuckGo（備援）** 三層容錯搜尋工具
- [ ] 在 LangGraph 中加入 `bind_tools`
- [ ] 使用 `ToolMessage` 保持訊息鏈完整性
- [ ] 在 SSE 中加入 `on_tool_start` 和 `on_tool_end` 事件監聽
- [ ] 實作 Moderator 節點（總結報告）

#### 前端任務
- [ ] 在 UI 上顯示「Agent 正在搜尋中...」的狀態指示器
- [ ] 實作搜尋結果來源顯示
- [ ] 添加總結報告展示區
- [ ] 優化整體 UI/UX

#### 驗收標準
✅ Agent 能自動調用搜尋工具
✅ 搜尋狀態在 UI 上清晰顯示
✅ 辯論結束後顯示總結報告
✅ 三層容錯機制正常運作

---

## 5. 部署與配置清單

### 5.1 Google Cloud Run (Backend)

#### 專案結構

```
backend/
├── pyproject.toml          # uv 依賴配置
├── uv.lock                 # 依賴鎖定檔
├── Dockerfile              # 容器化配置
├── app/
│   ├── main.py            # FastAPI 應用
│   ├── graph.py           # LangGraph 定義
│   ├── agents/            # Agent 節點
│   │   ├── optimist.py
│   │   ├── skeptic.py
│   │   └── moderator.py
│   └── tools/             # 搜尋工具
│       ├── tavily.py
│       └── duckduckgo.py
└── .env.example           # 環境變數範例
```

#### pyproject.toml

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
    "langgraph>=0.2.0",
    "tavily-python>=0.5.0",
    "duckduckgo-search>=6.0.0",
    "python-dotenv>=1.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

#### Dockerfile (使用 uv)

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# 複製依賴定義
COPY pyproject.toml uv.lock* ./

# 安裝依賴（生產環境）
RUN uv sync --frozen --no-dev

# 複製應用程式碼
COPY app ./app

# 暴露端口
EXPOSE 8080

# 啟動應用
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### 部署指令

```bash
# 私有部署（推薦）
gcloud run deploy debate-api \
  --source . \
  --region asia-east1 \
  --set-env-vars GROQ_API_KEY=${GROQ_API_KEY},TAVILY_API_KEY=${TAVILY_API_KEY} \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10

# 取得服務 URL
gcloud run services describe debate-api \
  --region asia-east1 \
  --format 'value(status.url)'
```

#### 環境變數

| 變數名稱 | 說明 | 範例 |
|:---|:---|:---|
| `GROQ_API_KEY` | Groq API 金鑰 | `gsk_xxxx...` |
| `TAVILY_API_KEY` | Tavily API 金鑰 | `tvly-xxxx...` |
| `API_SECRET_KEY` | 簡單 API Key 驗證 | `your-secret-key` |
| `ALLOWED_ORIGINS` | CORS 允許的來源（逗號分隔） | `https://debate-ai.pages.dev` |

#### CORS 配置 (main.py)

```python
import os
from fastapi.middleware.cors import CORSMiddleware

# ⚠️ 重要：不支援 *.pages.dev 通配符
# 必須填入實際的完整域名
ALLOWED_ORIGINS = [
    "http://localhost:3000",                      # 本地開發
    "https://debate-ai-abc123.pages.dev",         # Cloudflare Pages
    # 如有多個部署環境，逐一列出
]

# 或從環境變數讀取（推薦）
if os.getenv("ALLOWED_ORIGINS"):
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)
```

---

### 5.2 Cloudflare Pages (Frontend)

#### 專案結構

```
frontend/
├── package.json
├── next.config.js          # 配置 output: 'export'
├── .env.example            # 環境變數範例
├── app/
│   ├── layout.tsx
│   ├── page.tsx           # 主頁面
│   └── components/
│       ├── DebateUI.tsx   # 辯論介面
│       ├── ChatBubble.tsx # 對話氣泡
│       └── TopicForm.tsx  # 主題輸入表單
└── lib/
    └── api.ts             # API 調用邏輯
```

#### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // 靜態導出
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
```

#### 環境變數

**開發環境 (`.env.local`)**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**生產環境 (Cloudflare Pages 設定)**
```bash
# 選項 1: 使用 Cloudflare Workers 代理（推薦）
NEXT_PUBLIC_API_URL=https://debate-ai.yourdomain.workers.dev

# 選項 2: 直連 Cloud Run（需處理認證）
NEXT_PUBLIC_API_URL=https://debate-api-xxx.run.app
```

#### 前端存取策略

**選項 1: Cloudflare Workers 代理（推薦）**

```javascript
// workers/api-proxy.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const backendUrl = `https://debate-api-xxx.run.app${url.pathname}`;
    
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${env.API_SECRET_KEY}`);
    
    return fetch(backendUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });
  },
};
```

**選項 2: Cloud Run 內建認證**

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const ID_TOKEN = process.env.NEXT_PUBLIC_ID_TOKEN;

export async function streamDebate(topic: string) {
  const eventSource = new EventSource(
    `${API_URL}/debate/stream?topic=${encodeURIComponent(topic)}`,
    {
      headers: {
        'Authorization': `Bearer ${ID_TOKEN}`,
      },
    }
  );
  return eventSource;
}
```

#### 部署步驟

```bash
# 1. 安裝依賴
npm install

# 2. 本地測試
npm run dev

# 3. 構建靜態檔案
npm run build

# 4. 部署到 Cloudflare Pages
# 方法 A: 透過 Git 自動部署（推薦）
git push origin main

# 方法 B: 使用 Wrangler CLI
npx wrangler pages deploy out
```

#### 取得 Cloudflare Pages 網址

```bash
# 部署後會顯示，格式為：
# https://[專案名稱]-[分支]-[隨機字串].pages.dev
# 例如：https://debate-ai-main-abc.pages.dev

# 或綁定自定義域名
# 例如：https://debate.yourdomain.com
```

---

### 5.3 搜尋工具配置

#### Tavily（主要）

```python
# app/tools/tavily.py
from tavily import TavilyClient
import os

tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

async def tavily_search(query: str) -> dict:
    try:
        results = tavily_client.search(
            query=query,
            max_results=3,
            search_depth="basic"
        )
        return {
            "success": True,
            "results": results["results"],
            "source": "tavily"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "source": "tavily"
        }
```

#### DuckDuckGo（備援）

```python
# app/tools/duckduckgo.py
from duckduckgo_search import DDGS

async def duckduckgo_search(query: str) -> dict:
    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=3))
        return {
            "success": True,
            "results": results,
            "source": "duckduckgo"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "source": "duckduckgo"
        }
```

#### 三層容錯策略

```python
# app/tools/search.py
async def web_search(query: str) -> dict:
    # 第一層：嘗試 Tavily
    result = await tavily_search(query)
    if result["success"]:
        return result
    
    # 第二層：嘗試 DuckDuckGo
    result = await duckduckgo_search(query)
    if result["success"]:
        return result
    
    # 第三層：優雅降級
    return {
        "success": False,
        "message": "搜尋服務暫時無法使用，Agent 將基於現有知識繼續辯論。",
        "source": "fallback"
    }
```

---

## 6. 預期成果

完成此計畫後，你將擁有：

### 6.1 技術展示

✅ **高效能的 AI 應用**
- 透過 Groq 實現近乎零延遲的 AI 回應
- Token-level streaming 提供流暢的用戶體驗

✅ **低成本/免費的架構**
- 善用 Cloud Run 免費額度
- Cloudflare 靜態託管完全免費
- Tavily 每月 1000 次免費查詢

✅ **完整的技術棧整合**
- **Multi-Agent Workflow**：LangGraph 狀態管理
- **Tool Use**：動態搜尋與事實查核
- **Streaming**：即時互動體驗

### 6.2 可展示的功能

1. **即時 AI 辯論**
   - 輸入主題，觀看兩個 Agent 即時對話
   - 每個字逐一顯示，提升互動感

2. **智能搜尋整合**
   - Agent 自動判斷是否需要搜尋
   - 搜尋結果融入論述
   - 三層容錯確保穩定性

3. **專業的總結報告**
   - Moderator 分析整場辯論
   - 提供平衡的結論與洞察

### 6.3 展示重點

當向面試官或同行展示時，強調：

- 🎯 **架構設計能力**：前後端分離、容器化部署
- 🤖 **AI 工程實力**：LangGraph multi-agent、工具調用
- ⚡ **性能優化經驗**：Groq LPU、串流技術
- 💰 **成本意識**：零成本實現企業級功能
- 🛡️ **穩定性思維**：三層容錯、優雅降級

---

## 7. 實施狀態

### 7.1 當前階段

**規劃完成，準備開始實施**

### 7.2 最新更新（2025-12-03）

根據最新技術棧和最佳實踐，本專案實施計畫已完成以下更新：

#### ✅ 技術棧優化
- **採用 uv 全家桶**：現代化 Python 工具鏈（比 pip 快 10-100 倍）
- **LangGraph 0.2+**：使用最新版本 API
- **Tavily 優先搜尋**：三層容錯策略（Tavily → DuckDuckGo → 優雅降級）

#### ✅ 架構改進
- **冷啟動優化**：前端 UX 改善 + Demo Keep-Alive 腳本
- **零成本架構**：完整的免費方案實施指南
- **安全性強化**：私有部署 + API Key 驗證

### 7.3 技術堆疊摘要

| 組件 | 技術 | 版本 | 說明 |
|:---|:---|:---|:---|
| **Python 工具鏈** | uv | latest | 現代化依賴管理 |
| **後端框架** | FastAPI | 0.115+ | 高效能 async API |
| **AI 框架** | LangGraph | 0.2+ | 最新 multi-agent API |
| **LLM** | Groq | Llama-3.1-70b | 超快推理速度 |
| **搜尋工具** | Tavily + DuckDuckGo | - | 三層容錯 |
| **前端** | Next.js | 14+ | App Router |
| **部署** | Cloud Run + Cloudflare | - | 零成本方案 |

### 7.4 快速開始

#### 步驟 1：安裝 uv

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

#### 步驟 2：參閱完整實施文檔

詳細的實施指南請參閱：**[IMPLEMENTATION.md](./IMPLEMENTATION.md)**

包含內容：
- ✅ 可行性評估（9/10 高度可行）
- 📋 完整的 Phase 0-3 實施步驟
- 💻 完整程式碼範例
- 🚀 部署指南
- 🛡️ 風險緩解策略
- 💰 零成本架構清單

#### 步驟 3：開始 Phase 0（專案初始化）

```bash
# 後端初始化
mkdir debate-ai-backend && cd debate-ai-backend
uv init
uv add fastapi uvicorn langchain langchain-groq langgraph

# 前端初始化
npx create-next-app@latest debate-ai-frontend
cd debate-ai-frontend
npm install
```

### 7.5 預期時程

| 階段 | 時間 | 內容 |
|:---|:---|:---|
| **Week 1** | 5-7 天 | 基礎建設 + 學習 LangGraph |
| **Week 2** | 5-7 天 | 核心 AI 辯論功能 |
| **Week 3** | 5-7 天 | 搜尋工具整合 |
| **Week 4** | 3-5 天 | 完善與展示準備 |

**總計**：約 1 個月完成 MVP + 進階功能

### 7.6 下一步行動

1. ⭐ **熟悉技術棧**：閱讀 LangGraph、FastAPI、Next.js 文檔
2. 🔑 **申請 API Keys**：Groq、Tavily
3. ☁️ **設定雲端帳號**：Google Cloud、Cloudflare
4. 📖 **閱讀 IMPLEMENTATION.md**：開始實施 Phase 0

---

## 📄 授權

MIT License

---

## 📞 聯絡資訊

如有任何問題或建議，歡迎聯絡專案維護者。

---

**最後更新**：2025-12-03
**專案版本**：v0.1.0
**文件狀態**：✅ 規劃完成，準備實施