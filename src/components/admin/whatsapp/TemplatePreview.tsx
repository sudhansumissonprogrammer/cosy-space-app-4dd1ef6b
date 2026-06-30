import { renderPreview, type TplDraft } from "@/lib/wa-template-validate";

type Props = { draft: TplDraft; samples: string[] };

export function TemplatePreview({ draft, samples }: Props) {
  const header = draft.header_type === "TEXT" && draft.header_text
    ? renderPreview(draft.header_text, samples) : "";
  const body = renderPreview(draft.body_text || "", samples);
  const footer = draft.footer_text || "";

  return (
    <div className="rounded-2xl p-4" style={{ background: "#e5ddd5" }}>
      <div className="ml-2 mr-10 rounded-xl bg-white p-3 shadow-sm relative">
        <div className="absolute -left-2 top-3 h-3 w-3 rotate-45 bg-white" />
        {draft.header_type === "IMAGE" && (
          <div className="mb-2 -mt-1 -mx-1 rounded-lg overflow-hidden bg-gray-100 aspect-[16/9] flex items-center justify-center">
            {draft.header_media_url
              ? <img src={draft.header_media_url} alt="" className="w-full h-full object-cover" onError={(e)=>{(e.currentTarget as any).style.display='none';}}/>
              : <span className="text-xs text-gray-500">🖼️ Image header</span>}
          </div>
        )}
        {draft.header_type === "VIDEO" && (
          <div className="mb-2 -mt-1 -mx-1 rounded-lg overflow-hidden bg-black aspect-[16/9] flex items-center justify-center text-white text-xs">
            ▶️ Video header
          </div>
        )}
        {draft.header_type === "DOCUMENT" && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-gray-50 border p-2 text-xs text-gray-700">
            📄 {draft.header_media_url?.split("/").pop() || "document.pdf"}
          </div>
        )}
        {header && <div className="font-semibold text-sm text-gray-900 mb-1.5">{header}</div>}

        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{body}</div>
        {footer && <div className="text-[11px] text-gray-500 mt-2">{footer}</div>}
        {draft.buttons?.length ? (
          <div className="mt-2 -mx-3 -mb-3 border-t border-gray-100 pt-1">
            {draft.buttons.map((b, i) => (
              <div key={i} className="py-1.5 text-center text-sm text-[#1da1f2] border-b last:border-b-0 border-gray-100">
                {b.type === "URL" ? "🔗 " : b.type === "PHONE_NUMBER" ? "📞 " : "↩️ "}{b.text || "Button"}
              </div>
            ))}
          </div>
        ) : null}
        <div className="text-[10px] text-gray-400 text-right mt-1">12:34 PM</div>
      </div>
    </div>
  );
}
