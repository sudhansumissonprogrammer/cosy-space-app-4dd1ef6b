import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  /** Rich in-chat card (e.g. the AI image studio) attached to this answer. */
  card?: any;
}

export interface AssistantSource {
  id: string;
  title: string;
  route: string;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-assistant`;

/**
 * Chat state for the in-dashboard Store Assistant.
 * Streams the answer from the `dashboard-assistant` edge function.
 */
export function useStoreAssistant(storeId?: string) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sources, setSources] = useState<AssistantSource[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationId.current = null;
    setMessages([]);
    setSources([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (question: string, page?: string) => {
      const text = question.trim();
      if (!text || !storeId || isStreaming) return;

      setError(null);
      setSources([]);
      const history = messages.slice(-12);
      setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Please sign in again.");

        const res = await fetch(FN_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            store_id: storeId,
            conversation_id: conversationId.current,
            message: text,
            page,
            history,
          }),
        });

        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || "The assistant could not answer right now.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const appendToLast = (chunk: string) =>
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.conversation_id !== undefined) {
                conversationId.current = parsed.conversation_id ?? conversationId.current;
                if (Array.isArray(parsed.sources)) setSources(parsed.sources);
                const card = Array.isArray(parsed.cards) ? parsed.cards[0] : null;
                if (card) {
                  setMessages((m) => {
                    const next = [...m];
                    const last = next[next.length - 1];
                    if (last?.role === "assistant") next[next.length - 1] = { ...last, card };
                    return next;
                  });
                }
                continue;
              }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) appendToLast(delta);
            } catch {
              /* partial JSON — wait for more */
            }
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        const msg = e?.message || "Something went wrong. Please try again.";
        setError(msg);
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) next.pop();
          return next;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [storeId, isStreaming, messages],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { messages, sources, isStreaming, error, send, stop, reset };
}
