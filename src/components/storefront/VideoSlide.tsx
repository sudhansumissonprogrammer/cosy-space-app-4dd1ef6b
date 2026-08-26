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
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  // True from the moment playback is requested until the decoder actually
  // renders frames (`playing`), and again whenever the buffer runs dry.
  const [buffering, setBuffering] = useState(false);

  const showOverlay = (!hasStarted || !videoPlaying) && !buffering;


  // Warm the video *before* the shopper swipes to it. `preload="none"` meant
  // the first frame had to be fetched + decoded during the swipe, which showed
  // up as a stutter/black flash on the transition. Metadata (a few KB range
  // request) is fetched only once the browser is idle, so the LCP image on the
  // first slide is never delayed.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (warm || !source) return;
    let cancelled = false;
    const arm = () => !cancelled && setWarm(true);
    const idle = (window as any).requestIdleCallback;
    const id = typeof idle === "function" ? idle(arm, { timeout: 2500 }) : window.setTimeout(arm, 1200);
    return () => {
      cancelled = true;
      const cancel = (window as any).cancelIdleCallback;
      if (typeof idle === "function" && typeof cancel === "function") cancel(id);
      else window.clearTimeout(id as number);
    };
  }, [warm, source]);

  useEffect(() => {
    if (!isActive && videoRef.current) {
      videoRef.current.pause();
      setBuffering(false);
    }
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
    if (video.readyState < 3) setBuffering(true);
    video.play().then(() => setHasStarted(true)).catch(() => {
      // The visible play button remains available if a browser blocks autoplay.
      setBuffering(false);
    });
  }, [isActive, source]);



  if (!source) {
    return (
      <div className="relative flex-[0_0_100%] min-w-0 h-full sm:aspect-[4/5] sm:h-auto overflow-hidden"
      style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}>
        {poster && <img src={poster} alt="" aria-hidden className="h-full w-full object-contain" />}
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
      className="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden sm:h-auto sm:aspect-[4/5]"
      style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}
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
          className="absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain"
          draggable={false}
        />
      )}
      <video
        ref={videoRef}
        src={source}
        poster={poster}
        preload={isActive || warm ? "metadata" : "none"}
        autoPlay={isActive}
        muted
        playsInline
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        className="sf-video-nocontrols absolute inset-0 z-[1] m-auto h-auto max-h-full w-auto max-w-full object-contain [transform:translateZ(0)] [backface-visibility:hidden]"

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
          // Keep the video element, poster, and custom controls mounted. Mobile
          // WebViews can emit recoverable media errors while switching slides;
          // unmounting here made retry impossible and looked like no player.
          setVideoPlaying(false);
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
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl ring-1 ring-black/10 transition-transform duration-200 group-hover:scale-105">
            {/* Optical alignment: triangle is visually centered with a ~2px nudge right */}
            <Play className="h-7 w-7 text-black translate-x-[2px]" fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      )}

      {isActive && (
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
