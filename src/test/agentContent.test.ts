import { describe, expect, it } from "vitest";
import { prefersMarkdown } from "../../supabase/functions/_shared/agentContent";

describe("agent format negotiation", () => {
  it.each([null, "", "*/*", "text/html", "text/markdown;q=0", "text/markdown;q=0.3,text/html;q=0.9", "text/markdown;q=invalid"])("keeps HTML for %s", accept => {
    expect(prefersMarkdown(accept)).toBe(false);
  });
  it.each(["text/markdown", "text/markdown, text/html", "text/html;q=0.5,text/markdown;q=0.9", "TEXT/MARKDOWN; q=1"])("selects Markdown for %s", accept => {
    expect(prefersMarkdown(accept)).toBe(true);
  });
});