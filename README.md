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
| **前端 (Frontend)** | **Next.js 14+ (App Router)** | • 部署於 **Cloudflare Pages**<br>• 使用 `output: 'export'` 靜態導出<br>• 透過 `EventSource` 接收 SSE 串流 |
| **後端 (Backend)** | **Python 3.11+ (FastAPI)** | • 部署於 **Google Cloud Run** (Docker Container)<br>• 負責運行 LangGraph 狀態機<br>• 提供 SSE 串流接口 |
| **AI 核心 (LLM)** | **Groq (Llama-3-70b)** | • **首選**。利用 Groq 的 LPU 提供每秒 300+ token 的超快推理，讓辯論像真人對話。<br>• 備選：OpenRouter (免費模型) |
| **工具 (Tools)** | **DuckDuckGo / Tavily** | • **DuckDuckGo：** 開發期完全免費。<br>• **Tavily：** 專為 AI 設計的搜尋 API (每月 1000 次免費)，用於正式展示。 |
| **通訊協定** | **HTTP + SSE** | • 使用 **Server-Sent Events** 實現打字機效果，即時推送 Agent 的思考過程與發言。 |

---

## 3. 功能詳細規格 (Functional Specifications)

### 3.1 LangGraph 流程設計 (Backend Logic)

後端將維護一個 `StateGraph`，控制辯論的流向。

*   **狀態定義 (State Schema):**
    ```python
    class DebateState(TypedDict):
        messages: List[BaseMessage]  # 完整的對話歷史
        topic: str                   # 辯論主題
        current_speaker: str         # 下一位發言者 (optimist/skeptic)
        round_count: int             # 當前輪數
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

1.  **Backend:** 使用 LangGraph 的 `astream_events(version="v1")` 監聽 `on_chat_model_stream` 事件。
2.  **Transport:** 將捕捉到的 Token 包裝為 SSE 格式 (`data: {"node": "optimist", "text": "我"}\n\n`) 推送。
3.  **Frontend:** 瀏覽器建立單一長連接，根據 `node` 欄位決定將文字渲染在哪個對話框（左邊或右邊）。

---

## 4. 開發階段規劃 (Roadmap)

### 🔴 Phase 1: 基礎架構連通 (Infrastructure MVP)
**目標：** 確保 Cloudflare 前端能連上 Cloud Run 後端，並看到字在動。

*   [後端] 建立 FastAPI 專案，撰寫 `Dockerfile`。
*   [後端] 實作一個 Fake SSE 接口 (每秒回傳 "Hello" -> "World")。
*   [後端] **關鍵設定：** 配置 `CORSMiddleware` 允許 `*.pages.dev`。
*   [後端] 部署至 **Google Cloud Run**。
*   [前端] 建立 Next.js 介面，使用 `EventSource` 連接後端 URL。
*   [前端] 部署至 **Cloudflare Pages**。

### 🟡 Phase 2: 接入 LangGraph 與 Groq (Core Logic)
**目標：** 真正的 AI 辯論，Agent 能夠針對主題對話。

*   [後端] 申請 **Groq API Key** 並寫入 Cloud Run 環境變數。
*   [後端] 實作 `Optimist` 與 `Skeptic` 的 LangGraph 節點。
*   [後端] 將 `astream_events` 串接到 FastAPI 的 `StreamingResponse`。
*   [前端] 優化 UI，根據 Agent 角色顯示不同顏色的對話氣泡。

### 🟢 Phase 3: 工具調用與完善 (Advanced Features)
**目標：** 加入聯網能力，讓辯論言之有物。

*   [後端] 整合 **DuckDuckGo** 或 **Tavily** 工具。
*   [後端] 在 LangGraph 中加入 `bind_tools`，允許 Agent 自主決定何時搜尋。
*   [前端] 在 UI 上顯示「Agent 正在搜尋中...」的狀態指示器。
*   [全棧] 增加「回合數設定」與「總結報告」功能。

---

## 5. 部署與配置清單 (Configuration Checklist)

### 🔧 1. Google Cloud Run (Backend)
*   **Dockerfile:**
    ```dockerfile
    FROM python:3.11-slim
    WORKDIR /app
    COPY . .
    RUN pip install fastapi uvicorn langchain-groq langgraph duckduckgo-search
    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
    ```
*   **Deploy Command:**
    ```bash
    gcloud run deploy debate-api --source . --allow-unauthenticated
    ```
*   **Environment Variables:**
    *   `GROQ_API_KEY`: `gsk_xxxx...`
    *   `TAVILY_API_KEY`: `tvly-xxxx...` (Phase 3 用)

### 🔧 2. Cloudflare Pages (Frontend)
*   **Env Variables (Build time):**
    *   `NEXT_PUBLIC_API_URL`: `https://debate-api-xxxxx.a.run.app` (填入 Cloud Run 產生的網址)
*   **CORS (FastAPI `main.py`):**
    ```python
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "https://你的專案.pages.dev"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```

---

## 6. 預期成果 (Expected Outcome)

完成此計畫後，你將擁有一個：
1.  **高效能的 AI 應用：** 透過 Groq 實現近乎零延遲的 AI 回應。
2.  **低成本/免費的架構：** 善用 Cloud Run 免費額度與 Cloudflare 靜態託管。
3.  **技術展示：** 完美呈現 **Multi-Agent Workflow**、**Tool Use** 與 **Streaming** 三大 AI 工程核心技能。

這份計畫書已經涵蓋了你所需的所有技術細節。準備好開始 Phase 1 了嗎？