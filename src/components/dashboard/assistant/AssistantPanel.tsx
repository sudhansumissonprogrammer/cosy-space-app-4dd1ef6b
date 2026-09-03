import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, RotateCcw, Square } from "lucide-react";
import { useStoreAssistant } from "@/hooks/useStoreAssistant";
import { starterQuestions } from "./starterQuestions";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string;
}

/** Turns `/dashboard/...` paths inside an answer into clickable links. */
function AnswerText({ text, onNavigate }: { text: string; onNavigate: (path: string) => void }) {
  const parts = text.split(/(\/dashboard[^\s,.)"'`]*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("/dashboard") ? (
          <button
            key={i}
            type="button"
            onClick={() => onNavigate(part)}
            className="font-medium text-primary underline underline-offset-2"
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function AssistantPanel({ open, onOpenChange, storeId }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const { messages, isStreaming, error, send, stop, reset } = useStoreAssistant(storeId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const ask = (question: string) => {
    setInput("");
    send(question, location.pathname);
  };

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Store Assistant
          </SheetTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" /> New chat
            </Button>
          )}
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ask me anything about running your store — payments, shipping, products, domain, marketing.
                I'll give you step-by-step instructions and take you straight to the right page.
              </p>
              <div className="space-y-2">
                {starterQuestions(location.pathname).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="w-full rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <AnswerText text={m.content} onNavigate={go} />
                ) : (
                  <span className="text-muted-foreground">Thinking…</span>
                )
              ) : (
                m.content
              )}
            </div>
          ))}

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              rows={1}
              placeholder="Ask how to do something…"
              className="min-h-[40px] max-h-32 resize-none"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={stop} aria-label="Stop">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => ask(input)}
                disabled={!input.trim() || !storeId}
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            The assistant explains and links — it never changes your settings.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
