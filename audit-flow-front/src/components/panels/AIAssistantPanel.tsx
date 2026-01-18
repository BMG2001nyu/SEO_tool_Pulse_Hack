import { useState, useRef, useEffect } from "react";
import { Send, Check, Loader2, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendChatMessage } from "@/lib/api";
import { useAudit } from "@/context/AuditContext";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  type?: "text" | "status" | "suggestion";
  isLoading?: boolean;
}

interface AIAssistantPanelProps {
  sessionId?: string | null;
}

const suggestionChips = [
  "What are the main SEO issues?",
  "How can I improve my page titles?",
  "Explain the missing meta descriptions",
  "What's my overall SEO health?",
];

export function AIAssistantPanel({ sessionId }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { auditStatus } = useAudit();

  const isAuditComplete = auditStatus?.status === "completed";

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message when audit completes
  useEffect(() => {
    if (isAuditComplete && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          type: "text",
          content: "Your SEO audit is complete! I've analyzed your website and I'm ready to help. Ask me anything about your audit results, SEO issues, or how to improve your website's search performance.",
        },
      ]);
    }
  }, [isAuditComplete, messages.length]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || !sessionId || !isAuditComplete) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      type: "text",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add loading message
    const loadingId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: loadingId,
        role: "assistant",
        type: "text",
        content: "",
        isLoading: true,
      },
    ]);

    try {
      const response = await sendChatMessage(sessionId, text);

      // Replace loading message with actual response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingId
            ? { ...msg, content: response.response, isLoading: false }
            : msg
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      // Replace loading with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingId
            ? {
                ...msg,
                content: "Sorry, I encountered an error. Please try again.",
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">AI Assistant</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status messages while audit is running */}
        {!isAuditComplete && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-3 h-3 text-primary animate-spin" />
              </div>
              <span className="text-muted-foreground">
                {auditStatus?.message || "Preparing audit..."}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Chat will be available once the audit completes.
            </p>
          </div>
        )}

        {/* Chat messages */}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MessageBubble message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Suggestion chips - show only when no messages or after welcome */}
        {isAuditComplete && messages.length <= 1 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
            {suggestionChips.map((chip, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleSend(chip)}
                disabled={isLoading}
                className="w-full text-left px-4 py-2.5 rounded-full bg-primary/20 text-primary text-sm hover:bg-primary/30 transition-colors border border-primary/30 disabled:opacity-50"
              >
                {chip}
              </motion.button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAuditComplete ? "Ask about your SEO audit..." : "Waiting for audit..."}
            disabled={!isAuditComplete || isLoading}
            className="flex-1 bg-muted/50 border-border/50 focus-visible:ring-primary"
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || !isAuditComplete || isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.type === "status") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          {message.timestamp === "✓" ? (
            <Check className="w-3 h-3 text-success" />
          ) : (
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
          )}
        </div>
        <span className="text-muted-foreground">{message.content}</span>
      </div>
    );
  }

  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-3 h-3 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isAssistant
            ? "bg-secondary/60 text-secondary-foreground rounded-tl-sm"
            : "bg-primary/30 text-foreground rounded-tr-sm"
        }`}
      >
        {message.isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        ) : (
          message.content
        )}
      </div>
      {!isAssistant && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
