# 🚀 專案計畫書：DebateAI - 多 Agent 即時辯論與協作平台

## 1. 專案概述 (Project Overview)
**DebateAI** 是一個基於 **LangGraph** 的多 Agent 協作平台，展示 AI 如何針對特定主題進行結構化的辯論與事實查核。專案重點在於展示 **複雜的 Agent 狀態管理**、**工具調用 (Tool Use)** 以及 **即時串流 (Streaming)** 的全端開發能力。

*   **核心價值：** 證明開發者具備 **Python (LangGraph/FastAPI)** 與 **Modern Frontend (Next.js)** 的整合能力，以及對 **LLM 推理速度優化 (Groq)** 的理解。

---

## 2. 系統架構設計 (System Architecture)

採用 **前後端分離 (Decoupled Architecture)**，確保最佳的互動體驗與後端邏輯的可擴展性。

### 🏗️ 技術堆疊 (Tech Stack)

| 領域 | 技術選型 | 詳細說明 / 部署策略 |
| :--- | :--- | :--- |
| **Python 工具鏈** | **uv** | • 現代化依賴管理（比 pip 快 10-100 倍）<br>• 內建依賴鎖定（uv.lock）<br>• 統一工具鏈 |
| **前端 (Frontend)** | **Next.js 14+ (App Router)** | • 部署於 **Cloudflare Pages**<br>• 使用 `output: 'export'` 靜態導出<br>• Phase 1 用 `EventSource` (GET)，Phase 2+ 用 `fetch + ReadableStream` (POST) |
| **後端 (Backend)** | **Python 3.11+ (FastAPI)** | • 部署於 **Google Cloud Run** (Docker Container)<br>• 使用 **uv** 管理依賴<br>• 提供 SSE 串流接口（私有部署） |
| **AI 框架** | **LangGraph 0.2+** | • 最新版本的 multi-agent 框架<br>• 使用 `astream_events` API<br>• 原生支援工具調用與串流 |
| **AI 核心 (LLM)** | **Groq (Llama-3.1-70b)** | • 利用 Groq 的 LPU 提供每秒 300+ token 的超快推理<br>• 使用 streaming 模式實現打字機效果 |
| **搜尋工具 (Tools)** | **Tavily (主) + DuckDuckGo (備援)** | • **Tavily：** 專為 AI 設計，極度穩定（1000 次/月免費）<br>• **DuckDuckGo：** 備援方案，完全免費<br>• **三層容錯**：Tavily → DuckDuckGo → 優雅降級 |
| **通訊協定** | **HTTP + SSE** | • Phase 1: GET + EventSource (簡單測試)<br>• Phase 2+: POST + fetch + ReadableStream (完整功能) |

---

## 3. 功能詳細規格 (Functional Specifications)

### 3.1 LangGraph 流程設計 (Backend Logic)

後端將維護一個 `StateGraph`，控制辯論的流向。

*   **狀態定義 (State Schema):**
    ```python
    from typing import Annotated
    from langgraph.graph import add_messages

    class DebateState(TypedDict):
        messages: Annotated[List[BaseMessage], add_messages]  # 自動累積訊息
        topic: str                                           # 辯論主題
        current_speaker: Literal["optimist", "skeptic", "end"]  # 下一位發言者
        round_count: int                                     # 當前輪數
        max_rounds: int                                      # 最大輪數
    ```

*   **節點 (Nodes) 與 角色:**
    1.  **Optimist (樂觀者):**
        *   **職責:** 從積極角度論述。
        *   **工具:** 若論點需要數據，自動調用 `web_search`。
    2.  **Skeptic (懷疑者):**
        *   **職責:** 找出對方邏輯漏洞，強調風險。
        *   **工具:** 若發現對方數據可疑，調用 `web_search` 進行查核。
    3.  **Moderator (主持人 - Phase 2):**
        *   **職責:** 當 `round_count` 達到上限時觸發，閱讀歷史並生成總結。

### 3.2 即時串流機制 (Real-Time Streaming)

為了解決 LLM 響應延遲的問題，系統將實現 **Token-Level Streaming**。

1.  **Backend:** 使用 LangGraph 的 `astream_events(version="v2")` 監聽 `on_chat_model_stream` 事件（v2 更穩定，節點資訊從 `tags` 獲取）。
2.  **Transport:** 將捕捉到的 Token 包裝為 SSE 格式 (`data: {"node": "optimist", "text": "我"}\n\n`) 推送。
3.  **Frontend:** 瀏覽器建立單一長連接，根據 `node` 欄位決定將文字渲染在哪個對話框（左邊或右邊）。

---

## 4. 開發階段規劃 (Roadmap)

### 🔴 Phase 1: 基礎架構連通 (Infrastructure MVP)
**目標：** 確保 Cloudflare 前端能連上 Cloud Run 後端，並看到字在動。

*   [後端] 建立 FastAPI 專案，撰寫 `Dockerfile`（使用 uv）。
*   [後端] 實作一個 Fake SSE 接口 (每秒回傳 "Hello" -> "World")。
*   [後端] **關鍵設定：** 配置 `CORSMiddleware`，從環境變數 `ALLOWED_ORIGINS` 讀取完整域名（**不支援** `*.pages.dev` 通配符）。
*   [後端] 部署至 **Google Cloud Run**（私有模式，使用 API Key 驗證）。
*   [前端] 建立 Next.js 介面，使用 `EventSource` 連接後端 URL。
*   [前端] 部署至 **Cloudflare Pages**，記下實際 URL 並更新後端 CORS 配置。

### 🟡 Phase 2: 接入 LangGraph 與 Groq (Core Logic)
**目標：** 真正的 AI 辯論，Agent 能夠針對主題對話。

*   [後端] 申請 **Groq API Key** 並寫入 Cloud Run 環境變數。
*   [後端] 實作 `Optimist` 與 `Skeptic` 的 LangGraph 節點。
*   [後端] 將 `astream_events` 串接到 FastAPI 的 `StreamingResponse`。
*   [前端] 優化 UI，根據 Agent 角色顯示不同顏色的對話氣泡。

### 🟢 Phase 3: 工具調用與完善 (Advanced Features)
**目標：** 加入聯網能力，讓辯論言之有物。

*   [後端] 整合 **Tavily（主）+ DuckDuckGo（備援）** 三層容錯搜尋工具。
*   [後端] 在 LangGraph 中加入 `bind_tools`，使用 `ToolMessage` 保持訊息鏈完整性。
*   [後端] 在 SSE 中加入 `on_tool_start` 和 `on_tool_end` 事件監聽。
*   [前端] 在 UI 上顯示「Agent 正在搜尋中...」的狀態指示器。
*   [全棧] 增加「回合數設定」與「總結報告」功能。

---

## 5. 部署與配置清單 (Configuration Checklist)

### 🔧 1. Google Cloud Run (Backend)

*   **pyproject.toml:**
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
    ```

*   **Dockerfile (使用 uv):**
    ```dockerfile
    FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim
    WORKDIR /app

    # 複製依賴定義
    COPY pyproject.toml uv.lock* ./

    # 安裝依賴
    RUN uv sync --frozen --no-dev

    # 複製應用程式碼
    COPY app ./app

    # 暴露端口
    EXPOSE 8080

    # 啟動應用
    CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
    ```

*   **Deploy Command (私有部署):**
    ```bash
    # 移除 --allow-unauthenticated，改用 API Key 或 Cloudflare Workers 代理
    gcloud run deploy debate-api \
      --source . \
      --region asia-east1 \
      --set-env-vars GROQ_API_KEY=${GROQ_API_KEY},TAVILY_API_KEY=${TAVILY_API_KEY} \
      --memory 512Mi \
      --cpu 1 \
      --timeout 300 \
      --min-instances 0 \
      --max-instances 10

    # 取得服務 URL（需要認證）
    gcloud run services describe debate-api --region asia-east1 --format 'value(status.url)'
    ```

*   **前端存取策略（二選一）:**
    1. **使用 Cloudflare Workers 代理**（推薦）:
       - 在 Cloudflare Workers 中設定 API Key
       - Workers 代理請求到 Cloud Run
       - 前端只連接 Workers URL

    2. **使用 Cloud Run 內建認證**:
       - 設定 `--no-allow-unauthenticated`
       - 前端在 header 加入 `Authorization: Bearer ${ID_TOKEN}`

*   **Environment Variables:**
    *   `GROQ_API_KEY`: `gsk_xxxx...`
    *   `TAVILY_API_KEY`: `tvly-xxxx...`
    *   `API_SECRET_KEY`: `your-secret-key` (用於簡單的 API Key 驗證)

### 🔧 2. Cloudflare Pages (Frontend)

*   **Env Variables (Build time):**
    *   `NEXT_PUBLIC_API_URL`:
      - **開發**: `http://localhost:8000`
      - **生產**: 如使用 Cloudflare Workers 代理，填入 Workers URL (e.g., `https://debate-ai.yourdomain.workers.dev`)
      - **直連**: 填入 Cloud Run URL (需處理認證)

*   **CORS 配置 (FastAPI `main.py`):**
    ```python
    import os

    # ⚠️ 重要：不要使用 *.pages.dev 通配符（Starlette 不支援）
    # 必須填入實際的完整域名
    ALLOWED_ORIGINS = [
        "http://localhost:3000",           # 本地開發
        "https://debate-ai-abc123.pages.dev",  # 替換成實際的 Cloudflare Pages URL
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
        allow_credentials=True,  # 如需認證，設為 True
    )
    ```

*   **取得 Cloudflare Pages 實際網址:**
    ```bash
    # 部署後會顯示，格式為：
    # https://[專案名稱]-[分支]-[隨機字串].pages.dev
    # 或綁定的自定義域名
    ```

---

## 6. 預期成果 (Expected Outcome)

完成此計畫後，你將擁有一個：
1.  **高效能的 AI 應用：** 透過 Groq 實現近乎零延遲的 AI 回應。
2.  **低成本/免費的架構：** 善用 Cloud Run 免費額度與 Cloudflare 靜態託管。
3.  **技術展示：** 完美呈現 **Multi-Agent Workflow**、**Tool Use** 與 **Streaming** 三大 AI 工程核心技能。

這份計畫書已經涵蓋了你所需的所有技術細節。準備好開始 Phase 1 了嗎？

---

## 📋 實施狀態

**當前階段**: 規劃完成，準備開始實施

### 最新更新（2025-12-03）

根據最新技術棧和最佳實踐，本專案實施計畫已更新：

✅ **採用 uv 全家桶** - 現代化 Python 工具鏈（比 pip 快 10-100 倍）
✅ **LangGraph 0.2+** - 使用最新版本 API
✅ **Tavily 優先搜尋** - 三層容錯策略（Tavily → DuckDuckGo → 優雅降級）
✅ **冷啟動優化** - 前端 UX 改善 + Demo Keep-Alive 腳本
✅ **零成本架構** - 完整的免費方案實施指南

### 快速開始

詳細的實施指南請參閱：

📖 **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - 完整實施文檔

包含內容：
- ✅ 可行性評估（9/10 高度可行）
- 📋 完整的 Phase 0-3 實施步驟
- 💻 完整程式碼範例
- 🚀 部署指南
- 🛡️ 風險緩解策略
- 💰 零成本架構清單

### 技術堆疊更新

| 組件 | 技術 | 版本 | 說明 |
|------|------|------|------|
| **Python 工具鏈** | uv | latest | 現代化依賴管理 |
| **後端框架** | FastAPI | 0.115+ | 高效能 async API |
| **AI 框架** | LangGraph | 0.2+ | 最新 multi-agent API |
| **LLM** | Groq | Llama-3.1-70b | 超快推理速度 |
| **搜尋工具** | Tavily + DuckDuckGo | - | 三層容錯 |
| **前端** | Next.js | 14+ | App Router |
| **部署** | Cloud Run + Cloudflare | - | 零成本方案 |

### 開始實施

```bash
# 1. 安裝 uv（Python 工具鏈）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. 參閱實施文檔
cat IMPLEMENTATION.md

# 3. 開始 Phase 0（專案初始化）
# 詳見 IMPLEMENTATION.md 中的 Phase 0 章節
```

### 預期時程

- **Week 1**: 基礎建設 + 學習 LangGraph
- **Week 2**: 核心 AI 辯論功能
- **Week 3**: 搜尋工具整合
- **Week 4**: 完善與展示準備

**總計**: 約 1 個月完成 MVP + 進階功能

---

## 📄 授權

MIT License