from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import re
import os

app = FastAPI(title="DebateAI API", version="0.1.0")

# ============================================================
# ✅ Regex CORS Middleware - 支援 Cloudflare Pages 動態域名
# ============================================================
class RegexCORSMiddleware(CORSMiddleware):
    """支援 regex 匹配的 CORS Middleware"""
    def is_allowed_origin(self, origin: str) -> bool:
        # 允許 localhost 開發環境
        if origin and origin.startswith("http://localhost"):
            return True
        # 允許所有 .pages.dev 結尾的域名（Cloudflare Pages）
        if origin and re.match(r"https://.*\.pages\.dev$", origin):
            return True
        # 允許自定義域名（從環境變數讀取）
        allowed = os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origin in allowed:
            return True
        return super().is_allowed_origin(origin)

app.add_middleware(
    RegexCORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 基本白名單
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# ============================================================
# 請求模型
# ============================================================
class DebateRequest(BaseModel):
    topic: str
    max_rounds: int = 3

# ============================================================
# Fake SSE 串流生成器（Phase 1 測試用）
# ============================================================
async def fake_debate_stream(topic: str, max_rounds: int = 3):
    """
    Phase 1 測試：模擬 AI 辯論的 SSE 串流
    
    事件類型：
    - status: 狀態更新
    - speaker: 發言者開始
    - token: 逐字輸出
    - speaker_end: 發言者結束
    - complete: 辯論完成
    """
    
    # 狀態：引擎啟動
    yield f"data: {json.dumps({'type': 'status', 'text': '⚡ 正在喚醒 AI 辯論引擎...'})}\n\n"
    await asyncio.sleep(0.5)
    
    yield f"data: {json.dumps({'type': 'status', 'text': '🔥 引擎已就緒，開始辯論！'})}\n\n"
    await asyncio.sleep(0.3)
    
    # 模擬辯論回合
    for round_num in range(1, max_rounds + 1):
        # ========== 樂觀者發言 ==========
        yield f"data: {json.dumps({'type': 'speaker', 'node': 'optimist', 'text': f'第 {round_num} 輪'})}\n\n"
        await asyncio.sleep(0.2)
        
        optimist_text = f"關於「{topic}」，我認為這是一個充滿機會的領域。科技的進步總是帶來新的可能性，我們應該以開放的心態擁抱變革。"
        if round_num > 1:
            optimist_text = f"針對懷疑者的觀點，我必須指出：每一次技術革命都曾引發類似的擔憂，但最終人類都成功適應並創造了更美好的未來。「{topic}」也不例外！"
        
        for char in optimist_text:
            yield f"data: {json.dumps({'type': 'token', 'node': 'optimist', 'text': char})}\n\n"
            await asyncio.sleep(0.03)  # 30ms 打字機效果
        
        yield f"data: {json.dumps({'type': 'speaker_end', 'node': 'optimist'})}\n\n"
        await asyncio.sleep(0.5)
        
        # ========== 懷疑者發言 ==========
        yield f"data: {json.dumps({'type': 'speaker', 'node': 'skeptic', 'text': f'第 {round_num} 輪'})}\n\n"
        await asyncio.sleep(0.2)
        
        skeptic_text = f"然而，我們必須謹慎看待「{topic}」。過度樂觀可能導致我們忽視潛在的風險與挑戰。歷史告訴我們，盲目的技術崇拜往往帶來意想不到的後果。"
        if round_num > 1:
            skeptic_text = f"樂觀者忽略了一個關鍵事實：這次的變革速度和規模是前所未有的。「{topic}」的影響可能比我們預期的更加深遠，我們需要更多的監管和準備。"
        
        for char in skeptic_text:
            yield f"data: {json.dumps({'type': 'token', 'node': 'skeptic', 'text': char})}\n\n"
            await asyncio.sleep(0.03)
        
        yield f"data: {json.dumps({'type': 'speaker_end', 'node': 'skeptic'})}\n\n"
        await asyncio.sleep(0.5)
    
    # 辯論完成
    yield f"data: {json.dumps({'type': 'complete', 'text': f'✅ 辯論結束！共進行了 {max_rounds} 輪精彩交鋒。'})}\n\n"

# ============================================================
# SSE 串流接口
# ============================================================
@app.post("/debate")
async def start_debate(req: DebateRequest):
    """
    啟動 AI 辯論串流
    
    - 使用 POST 方法（支援請求體）
    - 返回 SSE 格式的串流響應
    """
    return StreamingResponse(
        fake_debate_stream(req.topic, req.max_rounds),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # ⚠️ 關鍵：防止 Cloudflare/Nginx 緩衝
        }
    )

# ============================================================
# 基礎接口
# ============================================================
@app.get("/")
async def root():
    return {
        "message": "Welcome to DebateAI API 🎭",
        "version": "0.1.0",
        "phase": 1,
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "message": "DebateAI API is running",
        "phase": 1
    }
