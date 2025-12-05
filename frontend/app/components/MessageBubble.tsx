"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MessageBubbleProps {
  node: "optimist" | "skeptic" | "system";
  text: string;
  isTyping?: boolean;
  roundInfo?: string;
}

/**
 * 訊息氣泡組件 - shadcn/ui 版本
 *
 * - 樂觀者：綠色，靠左
 * - 懷疑者：紅色，靠右
 * - 系統：灰色，置中
 */
export function MessageBubble({
  node,
  text,
  isTyping = false,
  roundInfo,
}: MessageBubbleProps) {
  // 角色配置
  const roleConfig = {
    optimist: {
      emoji: "🤖",
      label: "樂觀者",
      containerClass: "mr-16",
      cardClass: "bg-emerald-950/40 border-emerald-500/30",
      textClass: "text-emerald-100",
    },
    skeptic: {
      emoji: "🧐",
      label: "懷疑者",
      containerClass: "ml-16",
      cardClass: "bg-rose-950/40 border-rose-500/30",
      textClass: "text-rose-100",
    },
    system: {
      emoji: "📢",
      label: "系統",
      containerClass: "mx-auto max-w-md",
      cardClass: "bg-slate-800/50 border-slate-600/30",
      textClass: "text-slate-300",
    },
  };

  const config = roleConfig[node];

  return (
    <div
      className={cn(
        config.containerClass,
        "animate-in fade-in slide-in-from-bottom-2"
      )}
    >
      <Card
        className={cn(
          config.cardClass,
          isTyping && "border-dashed animate-pulse"
        )}
      >
        <CardContent className="p-4">
          {/* 角色標籤 */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={node}>
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </Badge>
            {roundInfo && (
              <span className="text-xs text-slate-500">• {roundInfo}</span>
            )}
            {isTyping && (
              <span className="text-xs text-slate-500">正在輸入...</span>
            )}
          </div>

          {/* 訊息內容 */}
          <p className={cn(config.textClass, "leading-relaxed")}>
            {text}
            {isTyping && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default MessageBubble;
