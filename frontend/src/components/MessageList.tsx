import { Message as MessageType } from '@/types/chat';
import Message from './Message';
import { Sparkles } from 'lucide-react';

interface MessageListProps {
  messages: MessageType[];
  isLoading: boolean;
}

const MessageList = ({ messages, isLoading }: MessageListProps) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center mb-6 shadow-sm">
          <Sparkles size={32} className="text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground tracking-tight mb-3">
          How can I help you today?
        </h2>
        <p className="text-muted-foreground max-w-md text-base">
          I'm ready to assist with code, writing, analysis, research and more.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 md:px-0 max-w-4xl mx-auto w-full space-y-6">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex items-start gap-3 ml-1">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
            <div className="flex space-x-1.5 items-center h-5">
              <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot"></span>
              <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot"></span>
              <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;