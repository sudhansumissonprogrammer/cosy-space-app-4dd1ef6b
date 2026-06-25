import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { VideoControlBar } from "./VideoControlBar";

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const handleSeek = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value;
    setCurrentTime(value);
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
        preload="metadata"
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
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
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

      {hasStarted && (
        <VideoControlBar
          playing={videoPlaying}
          currentTime={currentTime}
          duration={duration}
          onToggle={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          onSeek={handleSeek}
        />
      )}
    </div>
  );
}
