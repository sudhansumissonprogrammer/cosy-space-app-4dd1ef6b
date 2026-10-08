import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = Omit<ComponentPropsWithoutRef<"img">, "onLoad"> & {
  onReady: (image: HTMLImageElement) => void;
};

/** Cached photos are checked after commit, never from a changing callback ref. */
export default function GalleryImage({ onReady, onError, src, ...props }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [recovery, setRecovery] = useState({ src, attempts: 0, failed: false });
  const current = recovery.src === src ? recovery : { src, attempts: 0, failed: false };

  useEffect(() => {
    const image = imageRef.current;
    if (src && image?.complete && image.naturalWidth > 0) {
      readyRef.current(image);
    }
  }, [src, current.attempts]);

  return <>
    <img
      {...props}
      key={`${src || "inactive"}:${current.attempts}`}
      src={src}
      ref={imageRef}
      onLoad={(event) => readyRef.current(event.currentTarget)}
      onError={(event) => {
        if (!src) return;
        // Retry the exact existing URL once; never invent a photo sibling or
        // keep retrying indefinitely on an unreliable mobile connection.
        if (current.attempts === 0) {
          setRecovery({ src, attempts: 1, failed: false });
          return;
        }
        setRecovery({ src, attempts: current.attempts, failed: true });
        onError?.(event);
      }}
    />
    {current.failed && <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 bg-background text-foreground" onClick={(event) => event.stopPropagation()}>
      <p className="text-sm text-muted-foreground">Photo couldn’t load</p>
      <Button variant="outline" size="sm" onClick={() => setRecovery({ src, attempts: current.attempts + 1, failed: false })}>
        <RefreshCw className="mr-2 h-4 w-4" /> Retry photo
      </Button>
    </div>}
  </>;
}