"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, Square } from "lucide-react";

export interface TopicFormProps {
  topic: string;
  setTopic: (topic: string) => void;
  isStreaming: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * 主題輸入表單組件 - shadcn/ui 版本
 *
 * - 固定在底部
 * - 支援 Enter 提交
 * - 串流中顯示停止按鈕
 */
export function TopicForm({
  topic,
  setTopic,
  isStreaming,
  onStart,
  onStop,
}: TopicFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStreaming && topic.trim()) {
      onStart();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && topic.trim()) {
        onStart();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-3">
        {/* 輸入框 */}
        <div className="flex-1">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="輸入辯論主題，例如：AI 會取代人類工作嗎？"
          />
        </div>

        {/* 按鈕區 */}
        {isStreaming ? (
          <Button type="button" variant="destructive" onClick={onStop}>
            <Square className="size-4" />
            停止
          </Button>
        ) : (
          <Button type="submit" disabled={!topic.trim()}>
            <Rocket className="size-4" />
            開始辯論
          </Button>
        )}
      </div>

      {/* 提示文字 */}
      <p className="mt-3 text-center text-xs text-slate-500">
        Powered by <span className="text-purple-400">LangGraph 1.0</span> &{" "}
        <span className="text-blue-400">Groq</span> • Phase 1 測試版
      </p>
    </form>
  );
}

export default TopicForm;
