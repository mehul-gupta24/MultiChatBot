import { useState } from 'react';
import { Message as MessageType } from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import { ClipboardIcon, CheckIcon, DocumentMagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import ToolCall from './ToolCall';
import clsx from 'clsx';
import { User, Sparkles, ShieldAlert } from 'lucide-react';

interface MessageProps {
  message: MessageType;
}

const Message = ({ message }: MessageProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(true);

  const isUser = message.role === 'user';
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(message.timestamp));

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={clsx("flex gap-3 group w-full", isUser ? 'justify-end' : 'justify-start')}>
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Sparkles size={14} className="text-primary" />
        </div>
      )}

      <div className={clsx("flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%]", isUser ? 'items-end' : 'items-start')}>
        <div
          className={clsx(
            "px-4 py-3 shadow-sm",
            isUser
              ? 'bg-foreground text-background rounded-2xl rounded-tr-md'
              : 'bg-card border border-border text-foreground rounded-2xl rounded-tl-md'
          )}
        >
          {message.fileAnalysis ? (
            <div className="file-analysis w-full">
              <div className="flex items-center mb-3 pb-2.5 border-b border-border">
                <div className="p-1.5 bg-primary/10 rounded-lg mr-2.5">
                  <DocumentMagnifyingGlassIcon className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold text-sm">{message.fileAnalysis.file_name || 'Unknown File'}</span>
              </div>

              <div className="bg-muted rounded-lg p-3 mb-3 text-sm">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded">
                    {message.fileAnalysis.file_type}
                  </span>
                  {message.fileAnalysis.processing_time && (
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded border border-border">
                      {message.fileAnalysis.processing_time.toFixed(2)}s
                    </span>
                  )}
                </div>
                <div className="flex items-center text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckIcon className="w-3.5 h-3.5 mr-1" />
                  Analysis Complete
                </div>
              </div>

              {message.fileAnalysis.ai_analysis && (
                <div className="mb-3">
                  <button onClick={() => setShowAiAnalysis(!showAiAnalysis)} className="flex items-center justify-between w-full text-sm font-semibold py-2 px-2 hover:bg-muted rounded-lg transition-colors">
                    <span>AI Insights</span>
                    {showAiAnalysis ? <ChevronUpIcon className="w-4 h-4 text-muted-foreground" /> : <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showAiAnalysis && (
                    <div className="text-sm leading-relaxed prose dark:prose-invert max-w-none message-content px-2 pt-1">
                      <ReactMarkdown>{message.fileAnalysis.ai_analysis}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {message.fileAnalysis.extracted_text && (
                <div>
                  <button onClick={() => setShowExtractedText(!showExtractedText)} className="flex items-center justify-between w-full text-sm font-semibold py-2 px-2 hover:bg-muted rounded-lg transition-colors">
                    <span>Raw Text</span>
                    {showExtractedText ? <ChevronUpIcon className="w-4 h-4 text-muted-foreground" /> : <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showExtractedText && (
                    <div className="bg-muted rounded-lg p-3 mt-1 max-h-60 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">
                        {message.fileAnalysis.extracted_text}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="message-content prose dark:prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors" target="_blank" rel="noopener noreferrer" />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>

              {message.consistencyInfo && (
                <div className="mt-4 pt-3 border-t border-border">
                  <div className={clsx(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium w-fit",
                    message.consistencyInfo.is_consistent
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  )}>
                    <ShieldAlert size={14} />
                    {message.consistencyInfo.is_consistent ? 'Verified' : 'Inconsistencies Detected'}
                  </div>
                </div>
              )}

              {!message.content && message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Agent Action</div>
                  <div className="space-y-2">
                    {message.toolCalls.map((toolCall) => (
                      <ToolCall
                        key={toolCall.id}
                        toolCall={toolCall}
                        toolResult={message.toolResults?.find(result => result.tool_call_id === toolCall.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={clsx("flex items-center gap-2 px-1", isUser ? "justify-end" : "justify-start")}>
          <span className="text-[10px] text-muted-foreground">{formattedTime}</span>
          {!isUser && (
            <button
              onClick={handleCopyToClipboard}
              className="text-muted-foreground hover:text-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy"
            >
              {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-1">
          <User size={14} className="text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default Message;