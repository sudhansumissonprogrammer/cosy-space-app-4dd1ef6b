import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { VideoControlBar } from "./VideoControlBar";
import { normalizeProductVideoUrl } from "@/lib/productVideoUrl";
import VideoBufferDots from "./VideoBufferDots";


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
  const source = normalizeProductVideoUrl(url);
  const [failed, setFailed] = useState(!source);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);


  useEffect(() => {
    const video = ref.current;
    if (!source || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        video.muted = true;
        setMuted(true);
        video.play().then(() => setStarted(true)).catch(() => {});
      } else {
        video.pause();
      }
    }, { threshold: [0, 0.6, 1] });
    observer.observe(video);
    return () => observer.disconnect();
  }, [source]);

  // Keep the element in sync when the shopper toggles sound.
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  /** Play with sound (real user gesture); fall back to muted if blocked. */
  const playWithSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setStarted(true);
    if (v.readyState < 3) setBuffering(true);
    const attempt = v.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        v.muted = true;
        setMuted(true);
        const retry = v.play();
        if (retry && typeof retry.catch === "function") retry.catch(() => {});
      });
    }
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playWithSound();
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    if (playing) {
      v.pause();
      return;
    }
    playWithSound();
  };

  const showOverlay = (!started || !playing) && !buffering;


  const handleSeek = (value: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = value;
    setCurrentTime(value);
  };

  if (!source || failed) {
    return (
      <div className="relative h-full w-full bg-black">
        {poster && <img src={poster} alt="" aria-hidden className="h-full w-full object-contain" />}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black" onClick={(e) => e.stopPropagation()}>
      <video
        ref={ref}
        src={source}
        poster={poster}
        className={className}
        disablePictureInPicture
        muted
        autoPlay
        playsInline
        preload="metadata"
        onClick={handleToggle}
        onPlay={() => { setStarted(true); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={() => setDuration(ref.current?.duration || 0)}
        onDurationChange={() => setDuration(ref.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(ref.current?.currentTime || 0)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
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

      {started && (
        <VideoControlBar
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          onToggle={handleToggle}
          onSeek={handleSeek}
          muted={muted}
          onToggleMute={(e) => {
            e.stopPropagation();
            setMuted((m) => !m);
          }}
        />
      )}
    </div>
  );
}
