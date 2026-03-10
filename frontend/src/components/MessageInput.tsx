import { useState, useRef, FormEvent, ChangeEvent, Fragment, useEffect } from 'react';
import {
  Send,
  Paperclip,
  X,
  FileText,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ChatMode } from '@/types/chat';
import { Dialog, Transition } from '@headlessui/react';
import clsx from 'clsx';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onFileUpload?: (file: File) => void;
  mode: ChatMode;
  isLoading: boolean;
  selectedTools: string[];
  setSelectedTools: (tools: string[]) => void;
  useConsistencyCheck?: boolean;
  setUseConsistencyCheck?: (value: boolean) => void;
}

const MessageInput = ({
  onSendMessage,
  onFileUpload,
  mode,
  isLoading,
  selectedTools,
  setSelectedTools,
  useConsistencyCheck = false,
  setUseConsistencyCheck
}: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToolDialog, setShowToolDialog] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const availableTools = [
    { id: 'web_search', name: 'Web Search', icon: '🌐' },
    { id: 'run_python_code', name: 'Code Runner', icon: '🐍' },
  ];

  const isAnalyzeMode = mode === 'analyze';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isAnalyzeMode && selectedFile) {
      onFileUpload?.(selectedFile);
      setSelectedFile(null);
      return;
    }
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleToolToggle = (toolId: string) => {
    setSelectedTools(
      selectedTools.includes(toolId)
        ? selectedTools.filter(id => id !== toolId)
        : [...selectedTools, toolId]
    );
  };

  const activeToolsCount = selectedTools.length;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-2">
      <form
        onSubmit={handleSubmit}
        className={clsx(
          "relative rounded-2xl bg-card border transition-all duration-200 shadow-sm",
          isFocused
            ? "border-primary/40 shadow-md ring-1 ring-primary/20"
            : "border-border hover:border-border/80"
        )}
      >
        {/* File Preview */}
        {selectedFile && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2.5 bg-muted p-2 rounded-xl w-fit">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <FileText size={16} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium truncate max-w-[150px]">{selectedFile.name}</span>
                <span className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
              <button type="button" onClick={() => setSelectedFile(null)} className="p-1 hover:bg-destructive/10 rounded-full transition-colors text-muted-foreground hover:text-destructive">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end p-2 pl-4 gap-1">
          {/* Upload */}
          {isAnalyzeMode && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 mb-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Paperclip size={18} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={isAnalyzeMode ? "Describe what to analyze..." : "Type a message..."}
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground py-3 resize-none min-h-[44px] max-h-[150px] text-sm leading-relaxed"
            disabled={isLoading}
            rows={1}
          />

          {/* Actions */}
          <div className="flex items-center gap-1 pb-1">
            {setUseConsistencyCheck && (
              <button
                type="button"
                onClick={() => setUseConsistencyCheck(!useConsistencyCheck)}
                className={clsx(
                  "p-2 rounded-lg transition-colors",
                  useConsistencyCheck
                    ? "text-orange-500 bg-orange-500/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Consistency Check"
              >
                <AlertCircle size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowToolDialog(true)}
              className={clsx(
                "p-2 rounded-lg transition-colors relative",
                activeToolsCount > 0
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Tools"
            >
              <Zap size={18} />
              {activeToolsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-[8px] font-bold text-white rounded-full flex items-center justify-center">
                  {activeToolsCount}
                </span>
              )}
            </button>

            <button
              type="submit"
              disabled={isLoading || (!message.trim() && !selectedFile)}
              className={clsx(
                "p-2 rounded-lg transition-all ml-0.5",
                message.trim() || selectedFile
                  ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </form>

      <div className="text-center mt-2">
        <span className="text-[10px] text-muted-foreground">
          Powered by Groq & OpenRouter • AI can make mistakes.
        </span>
      </div>

      {/* Tool Dialog */}
      <Transition appear show={showToolDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowToolDialog(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-border">
                  <Dialog.Title className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Zap className="text-primary" size={20} />
                    <span>Agent Tools</span>
                  </Dialog.Title>
                  <div className="space-y-2">
                    {availableTools.map(tool => {
                      const isActive = selectedTools.includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          onClick={() => handleToolToggle(tool.id)}
                          className={clsx(
                            "w-full flex items-center justify-between p-3.5 rounded-xl border transition-all",
                            isActive
                              ? "bg-primary/10 border-primary/30"
                              : "bg-muted/50 border-transparent hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{tool.icon}</span>
                            <span className={clsx("font-medium text-sm", isActive ? "text-primary" : "text-foreground")}>{tool.name}</span>
                          </div>
                          <div className={clsx(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            isActive ? "bg-primary border-primary" : "border-muted-foreground/30"
                          )}>
                            {isActive && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => setShowToolDialog(false)}
                      className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default MessageInput;
