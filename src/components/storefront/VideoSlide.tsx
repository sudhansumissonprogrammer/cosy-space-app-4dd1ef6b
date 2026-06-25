import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

interface VideoSlideProps {
  url: string;
  poster?: string;
  isActive: boolean;
  videoPlaying: boolean;
  setVideoPlaying: (v: boolean) => void;
}

/**
 * Product gallery video slide with a centered play-button overlay.
 * The overlay disappears once the user starts playback and reappears on pause.
 */
export function VideoSlide({ url, poster, isActive, videoPlaying, setVideoPlaying }: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const showOverlay = !hasStarted || !videoPlaying;

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    setHasStarted(true);
    v.play().catch(() => {
      /* user-gesture errors are silent */
    });
  };

  const handleToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (videoPlaying) {
      v.pause();
      return;
    }
    handlePlay();
  };

  return (
    <div
      className="relative flex-[0_0_100%] min-w-0 bg-black"
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        preload={isActive && (hasStarted || videoPlaying) ? "auto" : "none"}
        playsInline
        disablePictureInPicture
        className="w-full h-auto max-h-[80vh] object-contain bg-black"
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        onPlay={() => {
          setHasStarted(true);
          setVideoPlaying(true);
        }}
        onPause={() => setVideoPlaying(false)}
        onEnded={() => setVideoPlaying(false)}
      />



      {showOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          aria-label="Play video"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity duration-200 hover:bg-black/30 active:scale-[0.98]"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl backdrop-blur-sm ring-1 ring-black/10 transition-transform duration-200 group-hover:scale-105">
            {/* Optical alignment: triangle is visually centered with a ~2px nudge right */}
            <Play className="h-7 w-7 text-black translate-x-[2px]" fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      )}

      {videoPlaying && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            videoRef.current?.pause();
          }}
          aria-label="Pause video"
          className="absolute bottom-3 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition-transform duration-150 active:scale-[0.96]"
        >
          <Pause className="h-5 w-5" fill="currentColor" strokeWidth={0} />
        </button>
      )}
    </div>
  );
}
