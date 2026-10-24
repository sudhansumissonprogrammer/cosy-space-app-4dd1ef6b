import { useMobileCardActivation } from "@/hooks/useMobileCardActivation";
import { optimizeImageUrl } from "@/lib/imageOptimize";

export default function CategoryTilePhoto({ src, name }: { src: string; name: string }) {
  const { ref, active, mobile } = useMobileCardActivation();
  return <div ref={ref} className="h-full w-full">
    <img src={!mobile || active ? optimizeImageUrl(src, 400, 85) : undefined}
      alt={name} className="h-full w-full object-cover transition-transform duration-300 hh:group-hover:scale-105"
      loading={mobile && active ? "eager" : "lazy"} decoding="async" fetchPriority="low" width={300} height={300} />
  </div>;
}