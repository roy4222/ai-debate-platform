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

---

## 專案現狀

- **狀態**: 設計完成，實現未開始
- **已有**: 完整的技術規格書（README.md）
- **缺失**: 所有前後端代碼、配置文件、部署設定

---

## 可行性評估

### ✅ 優勢（高可行性因素）

1. **完整的技術規劃**
   - 清晰的三階段開發路線圖
   - 詳細的技術堆疊選型
   - 明確的部署策略

2. **成熟的技術選型**
   - **Python LangGraph 0.2+**: 最新版本的 multi-agent 框架
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
2. **備援策略**: Tavily 失敗時自動切換到 DuckDuckGo
3. **優雅降級**: 兩者都失敗時，基於已知知識回答（不會崩潰）

**好處：**
- Demo 永遠不會在面試官面前崩潰
- Tavily 1000 次/月免費額度足夠展示
- DuckDuckGo 作為無限次數備援

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
    "langgraph>=0.2.0",
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
  output: 'export',  // 靜態導出，適合 Cloudflare Pages
}

module.exports = nextConfig
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

**注意：** Phase 1 使用 **GET + EventSource** 僅用於測試假資料串流。Phase 2+ 將改用 **POST + fetch + ReadableStream** 處理真實 AI 對話。

### 後端實作

更新 `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import os

app = FastAPI(title="DebateAI API")

# ⚠️ CORS 不支援通配符，從環境變數讀取
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

async def fake_stream():
    """Phase 1 測試：每秒發送一個字"""
    words = ["Hello", " ", "World", "!", " ", "SSE", " ", "is", " ", "working!"]
    for word in words:
        yield f"data: {word}\n\n"
        await asyncio.sleep(0.5)

@app.get("/stream")
async def stream_endpoint():
    """Phase 1 測試接口（GET + EventSource）"""
    return StreamingResponse(
        fake_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 前端實作

創建 `frontend/app/page.tsx`:

```typescript
'use client';

import { useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const startStream = () => {
    const eventSource = new EventSource(
      process.env.NEXT_PUBLIC_API_URL + '/stream'
    );

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onmessage = (event) => {
      setMessage((prev) => prev + event.data);
    };
    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl mb-4 font-bold">DebateAI - Phase 1 Test</h1>
      <button
        onClick={startStream}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Start Stream
      </button>
      <div className="mt-4 p-4 border rounded bg-white">
        {isConnected && <span className="text-green-500">● Connected</span>}
        <p className="mt-2 font-mono">{message}</p>
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

def optimist_node(state: DebateState) -> dict:
    """樂觀者 Agent"""
    # 構建訊息列表（LangChain 標準格式）
    messages = [
        HumanMessage(content=f"""你是一位樂觀的辯手。主題：{state['topic']}

請從積極的角度論述，強調優點、機會和可能性。保持簡潔（2-3 句話）。

之前的對話：
{format_messages(state['messages'][-4:])}""")
    ]

    # ⚠️ 關鍵：使用 invoke 但 LangGraph 會自動處理串流
    # astream_events 會攔截並發出 on_chat_model_stream 事件
    response = llm.invoke(messages)

    return {
        "messages": [AIMessage(content=response.content, name="optimist")],
        "current_speaker": "skeptic",
    }

def skeptic_node(state: DebateState) -> dict:
    """懷疑者 Agent"""
    messages = [
        HumanMessage(content=f"""你是一位理性的懷疑者。主題：{state['topic']}

請從批判的角度論述，指出風險、問題和挑戰。保持簡潔（2-3 句話）。

之前的對話：
{format_messages(state['messages'][-4:])}""")
    ]

    response = llm.invoke(messages)

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

**⚠️ 重要說明：LangGraph 串流機制**

1. **為什麼 `invoke` 可以串流？**
   - 當 LLM 設定 `streaming=True` 時，LangGraph 的 `astream_events` 會攔截所有 LLM 調用
   - 即使節點內部使用 `invoke`，串流事件仍會被發出
   - 這是 LangGraph 0.2+ 的內部機制

2. **關鍵配置：**
   - LLM 必須設定 `streaming=True`
   - 使用 `astream_events(version="v2")` （v2 更穩定）
   - 監聽 `on_chat_model_stream` 事件

3. **替代方案（如需更精確控制）：**
   - 使用 `llm.astream()` 並手動處理 async generator
   - 但會讓節點函數變成 async，增加複雜度

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

    # ⚠️ 使用 version="v2" 更穩定
    async for event in debate_graph.astream_events(initial_state, version="v2"):
        event_type = event.get("event")

        # 監聽 LLM token 串流
        if event_type == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            if chunk and hasattr(chunk, 'content') and chunk.content:
                # v2 中節點資訊在 tags 中
                tags = event.get("tags", [])
                node = next((tag.split(":")[-1] for tag in tags if tag.startswith("seq:step:")), "unknown")

                data = {
                    "type": "token",
                    "node": node,
                    "text": chunk.content
                }
                yield f"data: {json.dumps(data)}\n\n"

        # 監聽工具調用開始
        elif event_type == "on_tool_start":
            tool_name = event.get("name")
            tool_input = event.get("data", {}).get("input", {})

            data = {
                "type": "tool_start",
                "tool": tool_name,
                "input": tool_input
            }
            yield f"data: {json.dumps(data)}\n\n"

        # 監聽工具調用完成
        elif event_type == "on_tool_end":
            tool_name = event.get("name")
            tool_output = event.get("data", {}).get("output", "")

            data = {
                "type": "tool_end",
                "tool": tool_name,
                "output": tool_output[:200]  # 限制長度避免過大
            }
            yield f"data: {json.dumps(data)}\n\n"

        # 監聽節點完成
        elif event_type == "on_chain_end":
            tags = event.get("tags", [])
            node_tag = next((tag for tag in tags if tag.startswith("seq:step:")), None)

            if node_tag:
                node = node_tag.split(":")[-1]
                data = {
                    "type": "node_end",
                    "node": node
                }
                yield f"data: {json.dumps(data)}\n\n"

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

**⚠️ 關鍵修正：**

1. **改用 v2 API**：
   - `astream_events(version="v2")` 更穩定
   - 節點資訊從 `tags` 獲取，格式為 `seq:step:{node_name}`

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
'use client';

import { useState } from 'react';

export default function Home() {
  const [topic, setTopic] = useState('AI will replace most human jobs');
  const [optimistText, setOptimistText] = useState('');
  const [skepticText, setSkepticText] = useState('');
  const [isDebating, setIsDebating] = useState(false);
  const [status, setStatus] = useState('');

  const startDebate = async () => {
    setIsDebating(true);
    setOptimistText('');
    setSkepticText('');
    setStatus('正在喚醒 AI 引擎...');

    const startTime = Date.now();

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, max_rounds: 3 })
      });

      const coldStartTime = Date.now() - startTime;
      if (coldStartTime > 3000) {
        setStatus('引擎已就緒，開始辯論！');
      } else {
        setStatus('辯論進行中...');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'token') {
                if (data.node === 'optimist') {
                  setOptimistText(prev => prev + data.text);
                } else if (data.node === 'skeptic') {
                  setSkepticText(prev => prev + data.text);
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      setStatus('辯論完成！');
    } catch (error) {
      setStatus('錯誤：' + (error as Error).message);
    } finally {
      setIsDebating(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">🎭 DebateAI</h1>
        <p className="text-gray-600 text-center mb-8">Multi-Agent AI Debate Platform</p>

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
            {isDebating ? status : '開始辯論'}
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
                {optimistText || '等待發言...'}
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
                {skepticText || '等待發言...'}
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
const [searchQuery, setSearchQuery] = useState('');

// 在 SSE 處理中檢測工具調用
if (data.type === 'tool_start') {
  // 工具開始執行
  setSearchQuery(data.input.query || 'Searching...');
  setIsSearching(true);
} else if (data.type === 'tool_end') {
  // 工具執行完成
  setIsSearching(false);
} else if (data.type === 'token') {
  // Token 串流（原有邏輯）
  // ...
}
```

#### 2. 更新 UI 顯示

在 UI 中顯示搜尋狀態：

```typescript
{isSearching && (
  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
    <svg className="animate-spin h-5 w-5 text-yellow-600" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <span className="text-yellow-800">🔍 正在搜尋：{searchQuery}</span>
  </div>
)}
```

#### 3. 完整的 SSE 處理邏輯

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));

      switch (data.type) {
        case 'token':
          // 更新對應 Agent 的文字
          updateAgentMessage(data.node, data.text);
          break;

        case 'tool_start':
          // 顯示搜尋中
          setSearchQuery(data.input.query || 'Searching...');
          setIsSearching(true);
          break;

        case 'tool_end':
          // 隱藏搜尋指示器
          setIsSearching(false);
          break;

        case 'node_end':
          // 節點完成（可選：顯示完成動畫）
          break;

        case 'complete':
          // 辯論完成
          setStatus('completed');
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
- 處理 `astream_events` 的不同事件類型
- 使用 LangGraph 0.2+ 的最新 API

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

## 後續擴展功能（Week 4）

根據測試結果，可選擇性加入：

1. **主題模板庫**: 預設 10 個熱門辯論主題
2. **對話歷史**: 使用 localStorage 儲存過往辯論
3. **Moderator 總結**: 第三個 agent 生成辯論總結
4. **分享功能**: 生成可分享的辯論記錄連結
5. **多語言支持**: 切換中英文介面
6. **深色模式**: UI 主題切換
7. **回合進度條**: 顯示當前辯論進度
8. **Export 功能**: 導出辯論記錄為 Markdown 或 PDF

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
2. ✅ 採用最新 LangGraph 0.2+ API
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
