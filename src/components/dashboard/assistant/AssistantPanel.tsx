import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowUp, RotateCcw, Square, ArrowUpRight } from "lucide-react";
import { useStoreAssistant } from "@/hooks/useStoreAssistant";
import { useIsMobile } from "@/hooks/use-mobile";
import { starterQuestions } from "./starterQuestions";
import { cn } from "@/lib/utils";
import { lazy, Suspense } from "react";

const ImageStudioCard = lazy(() => import("./ImageStudioCard"));

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
            className="mx-0.5 inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline font-medium text-primary transition-colors hover:bg-primary/15"
          >
            {part}
            <ArrowUpRight className="h-3 w-3" />
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function AssistantMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full text-primary-foreground ring-1 ring-primary/25",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.78) 100%)",
      }}
    >
      <Sparkles className="h-1/2 w-1/2" />
    </span>
  );
}

export default function AssistantPanel({ open, onOpenChange, storeId }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    if (!question.trim()) return;
    setInput("");
    send(question, location.pathname);
  };

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex w-full flex-col gap-0 border-border/70 bg-background p-0",
          isMobile
            ? "h-[92dvh] rounded-t-3xl shadow-[0_-20px_60px_-20px_hsl(var(--foreground)/0.4)]"
            : "sm:max-w-md",
        )}
      >
        {isMobile && (
          <div className="flex justify-center pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          </div>
        )}

        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between space-y-0 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <AssistantMark className="h-10 w-10 shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.7)]" />
            <div className="text-left">
              <SheetTitle className="text-[15px] font-semibold tracking-tight">
                Store Assistant
              </SheetTitle>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Online · step-by-step help
              </span>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs text-muted-foreground"
              onClick={reset}
            >
              <RotateCcw className="h-3.5 w-3.5" /> New
            </Button>
          )}
        </SheetHeader>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.length === 0 && (
            <div className="space-y-5">
              <div
                className="rounded-2xl border border-border/60 p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(160deg, hsl(var(--primary) / 0.10) 0%, hsl(var(--card)) 60%)",
                }}
              >
                <AssistantMark className="mb-3 h-9 w-9" />
                <p className="text-[15px] font-semibold tracking-tight text-foreground">
                  How can I help with your store?
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Payments, shipping, products, domain, marketing — I explain each step and take you
                  straight to the right page.
                </p>
              </div>

              <div className="space-y-2">
                <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Popular right now
                </p>
                {starterQuestions(location.pathname).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3 text-left text-[13.5px] leading-snug transition-colors active:bg-accent hh:hover:border-primary/40 hh:hover:bg-accent"
                  >
                    <span className="flex-1">{q}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.8)]">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <AssistantMark className="mt-0.5 h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                    {m.content ? (
                      <AnswerText text={m.content} onNavigate={go} />
                    ) : (
                      <span className="inline-block animate-pulse text-muted-foreground">
                        Thinking…
                      </span>
                    )}
                  </div>
                  {m.card?.type === "image_studio" && (
                    <Suspense
                      fallback={
                        <div className="h-40 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
                      }
                    >
                      <ImageStudioCard storeId={storeId} data={m.card} />
                    </Suspense>
                  )}
                </div>
              </div>
            ),
          )}

          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Composer */}
        <div className="border-t bg-card/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="relative rounded-2xl border border-border/70 bg-background shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
            <Textarea
              ref={inputRef}
              value={input}
              rows={1}
              placeholder="Ask how to do something…"
              className="max-h-32 min-h-[52px] resize-none border-0 bg-transparent py-3.5 pl-4 pr-14 text-[14px] shadow-none focus-visible:ring-0"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            {isStreaming ? (
              <Button
                size="icon"
                variant="outline"
                className="absolute bottom-2 right-2 h-9 w-9 rounded-full"
                onClick={stop}
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="absolute bottom-2 right-2 h-9 w-9 rounded-full shadow-[0_8px_18px_-10px_hsl(var(--primary)/0.9)] transition-transform active:scale-95"
                onClick={() => ask(input)}
                disabled={!input.trim() || !storeId}
                aria-label="Send question"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
            The assistant explains and links — it never changes your settings.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
