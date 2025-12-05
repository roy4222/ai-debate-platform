/**
 * API 客戶端 - SSE 串流處理
 */

// SSE 事件類型定義
export type SSEEvent =
    | { type: 'status'; text: string }
    | { type: 'speaker'; node: 'optimist' | 'skeptic'; text: string }
    | { type: 'token'; node: 'optimist' | 'skeptic'; text: string }
    | { type: 'speaker_end'; node: 'optimist' | 'skeptic' }
    | { type: 'complete'; text: string }
    | { type: 'error'; text: string };

// 辯論請求參數
export interface DebateRequest {
    topic: string;
    max_rounds?: number;
}

// API URL（從環境變數讀取）
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 串流辯論 API
 * 
 * @param request - 辯論請求參數
 * @param onEvent - SSE 事件回調
 * @param abortSignal - 用於取消請求的 AbortSignal
 * @returns Promise<void>
 */
export async function streamDebate(
    request: DebateRequest,
    onEvent: (event: SSEEvent) => void,
    abortSignal?: AbortSignal
): Promise<void> {
    const { topic, max_rounds = 3 } = request;

    try {
        const response = await fetch(`${API_URL}/debate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, max_rounds }),
            signal: abortSignal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        // 使用 ReadableStream 讀取 SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            // 解碼並累積到 buffer
            buffer += decoder.decode(value, { stream: true });

            // 按行分割處理
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最後一個不完整的行

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6)) as SSEEvent;
                        onEvent(data);
                    } catch (e) {
                        console.error('Failed to parse SSE event:', line, e);
                    }
                }
            }
        }

        // 處理 buffer 中剩餘的資料
        if (buffer.startsWith('data: ')) {
            try {
                const data = JSON.parse(buffer.slice(6)) as SSEEvent;
                onEvent(data);
            } catch (e) {
                // 忽略不完整的最後一行
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                onEvent({ type: 'status', text: '🛑 辯論已停止' });
            } else {
                onEvent({ type: 'error', text: error.message });
            }
        } else {
            onEvent({ type: 'error', text: '未知錯誤' });
        }
        throw error;
    }
}

/**
 * 健康檢查 API
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
        });
        return response.ok;
    } catch {
        return false;
    }
}
