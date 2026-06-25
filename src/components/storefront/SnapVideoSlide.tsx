import { useRef, useState } from "react";
import { Play } from "lucide-react";

interface Props {
  url: string;
  poster?: string;
  className?: string;
}

/**
 * Video tile with centered play-button overlay for non-Embla galleries
 * (e.g. native scroll-snap rows in V19/V20). The overlay disappears once
 * playback starts and reappears on pause.
 */
export function SnapVideoSlide({ url, poster, className = "h-full w-full object-contain bg-black" }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    v.play().catch(() => {});
  };

  const showOverlay = !started || !playing;

  return (
    <div className="relative h-full w-full bg-black" onClick={(e) => e.stopPropagation()}>
      <video
        ref={ref}
        src={url}
        poster={poster}
        className={className}
        controls={started}
        controlsList="nofullscreen nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        preload="metadata"
        onPlay={() => { setStarted(true); setPlaying(true); }}
        onPause={() => setPlaying(false)}
      />

      {showOverlay && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Play video"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity duration-200 hover:bg-black/30 active:scale-[0.98]"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl backdrop-blur-sm ring-1 ring-black/10">
            <Play className="h-7 w-7 text-black translate-x-[2px]" fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      )}
    </div>
  );
}
