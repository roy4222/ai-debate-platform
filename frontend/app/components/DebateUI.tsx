"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { TopicForm } from "./TopicForm";
import { streamDebate, SSEEvent } from "../lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords } from "lucide-react";

// 訊息類型
interface Message {
  node: "optimist" | "skeptic" | "system";
  text: string;
  roundInfo?: string;
}

/**
 * DebateUI - 辯論主介面組件 (shadcn/ui 版本)
 *
 * 核心功能：
 * - SSE 串流處理
 * - useRef 解決 React 狀態非同步問題
 * - 自動滾動
 * - 連線階段 30 秒超時（首包後解除）
 */
export function DebateUI() {
  // ============================================================
  // 狀態管理
  // ============================================================
  const [topic, setTopic] = useState("AI 會取代大部分人類工作嗎？");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentText, setCurrentText] = useState<{ [key: string]: string }>({});
  const [currentRound, setCurrentRound] = useState<{ [key: string]: string }>(
    {}
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const [connectionTime, setConnectionTime] = useState<number | null>(null);

  // ============================================================
  // Refs - 解決 React 狀態非同步問題
  // ============================================================
  const textBufferRef = useRef<{ [key: string]: string }>({});
  const roundInfoRef = useRef<{ [key: string]: string }>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ⚠️ 修正：記錄連線開始時間和首包是否到達
  const connectionStartTimeRef = useRef<number>(0);
  const firstChunkReceivedRef = useRef<boolean>(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // ============================================================
  // 自動滾動
  // ============================================================
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentText]);

  // ============================================================
  // 清空所有暫存狀態
  // ============================================================
  const clearAllBuffers = useCallback(() => {
    textBufferRef.current = {};
    roundInfoRef.current = {};
    setCurrentText({});
    setCurrentRound({});
  }, []);

  // ============================================================
  // SSE 事件處理器
  // ============================================================
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    // ⚠️ 修正：首包到達時記錄連線時間並解除超時
    if (!firstChunkReceivedRef.current) {
      firstChunkReceivedRef.current = true;
      const elapsed = Date.now() - connectionStartTimeRef.current;

      // 清除連線超時（首包已到達，改為無限制串流）
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      // 只有連線時間 > 3 秒才顯示（表示有冷啟動）
      if (elapsed > 3000) {
        setConnectionTime(elapsed);
      }
    }

    switch (event.type) {
      case "status":
        setStatus(event.text);
        break;

      case "speaker":
        textBufferRef.current[event.node] = "";
        roundInfoRef.current[event.node] = event.text;
        setCurrentRound((prev) => ({
          ...prev,
          [event.node]: event.text,
        }));
        break;

      case "token":
        textBufferRef.current[event.node] =
          (textBufferRef.current[event.node] || "") + event.text;

        setCurrentText((prev) => ({
          ...prev,
          [event.node]: textBufferRef.current[event.node],
        }));
        break;

      case "speaker_end":
        const finalText = textBufferRef.current[event.node] || "";
        const roundInfo = roundInfoRef.current[event.node] || "";

        setMessages((prev) => [
          ...prev,
          { node: event.node, text: finalText, roundInfo },
        ]);

        textBufferRef.current[event.node] = "";
        roundInfoRef.current[event.node] = "";
        setCurrentText((prev) => ({ ...prev, [event.node]: "" }));
        setCurrentRound((prev) => ({ ...prev, [event.node]: "" }));
        break;

      case "complete":
        setStatus(event.text);
        break;

      case "error":
        setStatus(`❌ 錯誤：${event.text}`);
        break;
    }
  }, []);

  // ============================================================
  // 開始辯論
  // ============================================================
  const startDebate = async () => {
    // 重置狀態
    setIsStreaming(true);
    setMessages([]);
    clearAllBuffers();
    setStatus("⚡ 正在連接 AI 辯論引擎...");
    setConnectionTime(null);

    // ⚠️ 修正：重置連線追蹤狀態
    connectionStartTimeRef.current = Date.now();
    firstChunkReceivedRef.current = false;

    // 建立 AbortController
    abortControllerRef.current = new AbortController();

    // ⚠️ 修正：30 秒超時僅作用於「連線/首包」階段
    // 收到首個 chunk 後會在 handleSSEEvent 中清除此超時
    connectionTimeoutRef.current = setTimeout(() => {
      if (!firstChunkReceivedRef.current) {
        abortControllerRef.current?.abort();
        setStatus("❌ 連接超時，引擎可能正在冷啟動，請重試");
      }
    }, 30000);

    try {
      await streamDebate(
        { topic, max_rounds: 3 },
        handleSSEEvent,
        abortControllerRef.current.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setStatus(`❌ 連接失敗：${error.message}`);
      }
    } finally {
      // 清理超時
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setIsStreaming(false);
    }
  };

  // ============================================================
  // 停止辯論
  // ============================================================
  const stopDebate = () => {
    abortControllerRef.current?.abort();

    // 清理超時
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // ⚠️ 修正：停止時清空所有暫存文字與 round 資訊
    clearAllBuffers();

    setIsStreaming(false);
    setStatus("🛑 辯論已停止");
  };

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* ========== Header ========== */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
              <Swords className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-blue-400 bg-clip-text text-transparent">
                DebateAI
              </h1>
              <p className="text-xs text-slate-500">Multi-Agent 即時辯論平台</p>
            </div>
          </div>

          {/* 狀態指示 */}
          <div className="text-right">
            {status && (
              <Badge variant="outline" className="text-slate-400">
                {status}
              </Badge>
            )}
            {connectionTime && (
              <p className="text-xs text-slate-500 mt-1">
                連線耗時：{(connectionTime / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ========== Main Chat Area ========== */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 歡迎訊息 */}
          {messages.length === 0 && !isStreaming && (
            <Card className="max-w-lg mx-auto text-center border-slate-700/50">
              <CardHeader className="pt-10 pb-8">
                <div className="text-6xl mb-4">🎭</div>
                <CardTitle className="text-xl">
                  準備好開始一場精彩的辯論了嗎？
                </CardTitle>
                <CardDescription className="text-slate-400 mt-2">
                  輸入一個主題，觀看 AI 樂觀者與懷疑者展開激烈交鋒。
                  每個論點都會即時串流顯示。
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* 已完成的訊息 */}
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              node={msg.node}
              text={msg.text}
              roundInfo={msg.roundInfo}
            />
          ))}

          {/* 正在輸入的訊息 */}
          {Object.entries(currentText).map(([node, text]) =>
            text ? (
              <MessageBubble
                key={`typing-${node}`}
                node={node as "optimist" | "skeptic"}
                text={text}
                isTyping={true}
                roundInfo={currentRound[node]}
              />
            ) : null
          )}

          {/* 自動滾動 anchor */}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* ========== Footer (Input Form) ========== */}
      <footer className="flex-shrink-0 px-6 py-4 border-t border-slate-800/50 backdrop-blur-sm bg-slate-950/50">
        <div className="max-w-4xl mx-auto">
          <TopicForm
            topic={topic}
            setTopic={setTopic}
            isStreaming={isStreaming}
            onStart={startDebate}
            onStop={stopDebate}
          />
        </div>
      </footer>
    </div>
  );
}

export default DebateUI;
