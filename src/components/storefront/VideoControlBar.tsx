import { Pause, Play, Volume2, VolumeX } from "lucide-react";

interface VideoControlBarProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSeek: (value: number) => void;
  muted?: boolean;
  onToggleMute?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}


const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
};

export function VideoControlBar({ playing, currentTime, duration, onToggle, onSeek }: VideoControlBarProps) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrent = safeDuration > 0 ? Math.min(currentTime, safeDuration) : 0;
  const progress = safeDuration > 0 ? (safeCurrent / safeDuration) * 100 : 0;

  return (
    <div
      className="absolute inset-x-3 bottom-3 z-20 rounded-full bg-black/65 px-2 py-1 text-white shadow-xl backdrop-blur-sm ring-1 ring-white/10"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? "Pause video" : "Play video"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-[0.96]"
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" strokeWidth={0} />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={safeDuration || 1}
          step="0.1"
          value={safeCurrent}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-label="Video progress"
          style={{ background: `linear-gradient(to right, #fff 0%, #fff ${progress}%, rgba(255,255,255,0.3) ${progress}%, rgba(255,255,255,0.3) 100%)` }}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white"
        />

        <span className="min-w-[3.5rem] text-right text-[10px] font-medium tabular-nums text-white/90">
          {formatTime(safeCurrent)} / {formatTime(safeDuration)}
        </span>
      </div>
    </div>
  );
}