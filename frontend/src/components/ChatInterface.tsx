import { useState, useEffect, useRef, forwardRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ChatMode, Message, ChatRequest } from '@/types/chat';
import { streamChatMessage, analyzeFile } from '@/services/api';

interface ChatInterfaceProps {
  mode: ChatMode;
}

const ChatInterface = forwardRef<HTMLDivElement, ChatInterfaceProps>(({ mode }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [useConsistencyCheck, setUseConsistencyCheck] = useState(false);
  const streamingIdRef = useRef<string | null>(null);

  // Reset messages when mode changes
  useEffect(() => {
    setMessages([]);
  }, [mode]);

  // Auto-scroll when messages update
  useEffect(() => {
    if (ref && typeof ref !== 'function' && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [messages, ref]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
      mode,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create a placeholder assistant message that will be updated with streamed tokens
    const assistantId = uuidv4();
    streamingIdRef.current = assistantId;

    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      mode,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const conversationHistory = messages
        .filter(msg => msg.mode === mode)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      let fileContext = null;
      if (mode === 'analyze') {
        const lastFileAnalysis = [...messages].reverse().find(msg => msg.fileAnalysis);
        if (lastFileAnalysis?.fileAnalysis) {
          fileContext = {
            file_name: lastFileAnalysis.fileAnalysis.file_name || 'Unknown File',
            file_type: lastFileAnalysis.fileAnalysis.file_type,
            extracted_text: lastFileAnalysis.fileAnalysis.extracted_text || '',
          };
        }
      }

      const request: ChatRequest = {
        mode,
        message: content,
        conversation_history: conversationHistory,
        file_context: fileContext,
        selected_tools: selectedTools,
        consistency_check: useConsistencyCheck,
      };

      await streamChatMessage(
        request,
        // onToken — append each token to the assistant message
        (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },
        // onToolStart
        (toolNames) => {
          toast.info(`🔧 Running: ${toolNames.join(', ')}`, {
            autoClose: 3000,
            position: 'bottom-right',
            theme: 'dark',
          });
        },
        // onToolResult
        (_results) => {
          // Tool results processed, follow-up response will stream next
        },
        // onDone
        (doneEvent) => {
          // Update the final message with tool calls/results if present
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                  ...msg,
                  toolCalls: doneEvent.tool_calls,
                  toolResults: doneEvent.tool_results,
                }
                : msg
            )
          );

          if (doneEvent.token_count) {
            toast.info(`Tokens: ${doneEvent.token_count.total_tokens}`, {
              autoClose: 3000,
              position: 'bottom-right',
              theme: 'dark',
            });
          }
        },
        // onError
        (error) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: `Error: ${error}` }
                : msg
            )
          );
          toast.error(error);
        }
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Error: ${typeof error === 'string' ? error : 'Failed to get response'}` }
            : msg
        )
      );
      toast.error(typeof error === 'string' ? error : 'Failed to get response');
    } finally {
      setIsLoading(false);
      streamingIdRef.current = null;
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsLoading(true);

      if (mode === 'analyze') {
        const userMessage: Message = {
          id: uuidv4(),
          role: 'user',
          content: `Analyze file: ${file.name}`,
          timestamp: new Date(),
          mode,
        };
        setMessages((prev) => [...prev, userMessage]);

        const result = await analyzeFile(file);
        const analysisContent = result.ai_analysis || 'No AI analysis available.';

        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: analysisContent,
          timestamp: new Date(),
          mode,
          fileAnalysis: { ...result, file_name: file.name },
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `Error processing file: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        mode,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto w-full scroll-smooth" ref={ref}>
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        onFileUpload={handleFileUpload}
        mode={mode}
        isLoading={isLoading}
        selectedTools={selectedTools}
        setSelectedTools={setSelectedTools}
        useConsistencyCheck={useConsistencyCheck}
        setUseConsistencyCheck={setUseConsistencyCheck}
      />
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;