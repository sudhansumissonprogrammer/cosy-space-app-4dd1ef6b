import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { VideoControlBar } from "./VideoControlBar";
import { normalizeProductVideoUrl } from "@/lib/productVideoUrl";

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
  const source = normalizeProductVideoUrl(url);
  const [failed, setFailed] = useState(!source);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);

  const showOverlay = !hasStarted || !videoPlaying;

  useEffect(() => {
    if (!isActive && videoRef.current) videoRef.current.pause();
  }, [isActive]);

  // Keep the element in sync when the shopper toggles sound.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Fetch metadata only when the video slide is selected. This keeps the first
  // product image as LCP, but makes playback immediate after the shopper swipes
  // to the video instead of leaving the poster looking like a static photo.
  useEffect(() => {
    const video = videoRef.current;
    if (!isActive || !source || !video) return;
    video.muted = true;
    setMuted(true);
    video.play().then(() => setHasStarted(true)).catch(() => {
      // The visible play button remains available if a browser blocks autoplay.
    });
  }, [isActive, source]);


  if (!source || failed) {
    return (
      <div className="relative flex-[0_0_100%] min-w-0 bg-black h-[min(118vw,62svh)] sm:aspect-[4/5] sm:h-auto overflow-hidden">
        {poster && <img src={poster} alt="" aria-hidden className="h-full w-full object-cover" />}
      </div>
    );
  }

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    // The tap is a real user gesture, so sound is allowed. If the browser
    // still refuses (some in-app webviews), fall back to muted playback.
    v.muted = false;
    setMuted(false);
    setHasStarted(true);
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
      className="relative flex-[0_0_100%] min-w-0 bg-black h-[min(118vw,62svh)] sm:aspect-[4/5] sm:h-auto overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Poster fallback — guarantees the slide is never blank even if the
          <video> element fails to load (CSP media-src block, slow network,
          decoder error in Instagram/FB in-app browser). */}
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover bg-black"
          draggable={false}
        />
      )}
      <video
        ref={videoRef}
        src={source}
        poster={poster}
        preload={isActive ? "metadata" : "none"}
        autoPlay={isActive}
        muted
        playsInline
        disablePictureInPicture
        className="relative z-[1] w-full h-full object-cover bg-black"
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
        onError={() => {
          setVideoPlaying(false);
          setFailed(true);
        }}
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
