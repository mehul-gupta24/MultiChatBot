import axios from 'axios';
import { ChatRequest, ChatResponse, ModelMapping, FileAnalysis, StreamEvent } from '@/types/chat';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Streaming Chat (SSE) ─────────────────────────────────────────────────────

export async function streamChatMessage(
  request: ChatRequest,
  onToken: (token: string) => void,
  onToolStart?: (toolNames: string[]) => void,
  onToolResult?: (results: { name: string; has_result: boolean }[]) => void,
  onDone?: (event: StreamEvent & { event: 'done' }) => void,
  onError?: (error: string) => void,
): Promise<void> {
  const url = `${API_URL}/chat/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    onError?.(errorText || `HTTP ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError?.('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;

      try {
        const event: StreamEvent = JSON.parse(payload);

        switch (event.event) {
          case 'token':
            onToken(event.data);
            break;
          case 'tool_start':
            onToolStart?.(event.data);
            break;
          case 'tool_result':
            onToolResult?.(event.data);
            break;
          case 'done':
            onDone?.(event);
            break;
          case 'error':
            onError?.(event.data);
            break;
        }
      } catch {
        // Skip malformed events
      }
    }
  }
}

// ─── Non-Streaming Chat (fallback) ───────────────────────────────────────────

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await api.post<ChatResponse>('/chat', request);
  return response.data;
};

// ─── File Analysis ───────────────────────────────────────────────────────────

export const analyzeFile = async (file: File): Promise<FileAnalysis> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<FileAnalysis>('/analyze-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

// ─── Models ──────────────────────────────────────────────────────────────────

export const getModels = async (): Promise<ModelMapping> => {
  const response = await api.get<ModelMapping>('/models');
  return response.data;
};

// ─── Error Interceptor ──────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.message || error.response?.data?.detail || 'An error occurred';
    console.error('API Error:', errorMessage);
    return Promise.reject(errorMessage);
  }
);

export default api;