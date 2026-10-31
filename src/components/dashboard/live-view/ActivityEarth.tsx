import { useEffect, useRef, useState, useMemo } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshBasicMaterial } from "three";
import { geoEqualEarth, geoPath } from "d3-geo";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Globe2, Map, Minus, Plus, RotateCcw, Pause, Play } from "lucide-react";
import { countries, type ActivityPoint } from "./geography";

function token(name: string) { return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`; }
export default function ActivityEarth({ points }: { points: ActivityPoint[] }) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const [width, setWidth] = useState(700);
  const [mode, setMode] = useState<"globe" | "map">("globe");
  const [rotating, setRotating] = useState(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [selected, setSelected] = useState<ActivityPoint | null>(null);
  const palette = useMemo(() => ({ ocean: token("--earth-ocean"), land: token("--earth-land"), border: token("--earth-border"), order: token("--earth-order"), visitor: token("--earth-visitor") }), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: palette.ocean }), [palette]);
  const color = (p: ActivityPoint) => p.kind === "order" ? palette.order : palette.visitor;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) { setWebgl(false); setMode("map"); }
    return () => { observer.disconnect(); material.dispose(); };
  }, [material]);
  useEffect(() => {
    const g = globe.current;
    if (!g || !ready) return;
    g.controls().autoRotate = rotating;
    g.controls().autoRotateSpeed = 0.35;
    g.controls().minDistance = 150;
    g.controls().maxDistance = 700;
    const onVisibility = () => document.visibilityState === "hidden" ? g.pauseAnimation() : g.resumeAnimation();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [rotating, ready]);
  const projection = geoEqualEarth().fitExtent([[18, 18], [982, 482]], { type: "FeatureCollection", features: countries });
  const path = geoPath(projection);
  const zoom = (factor: number) => { const g = globe.current; if (g) g.pointOfView({ altitude: Math.min(4.5, Math.max(0.5, g.pointOfView().altitude * factor)) }, 300); };
  const controls = (zoomIn: () => void, zoomOut: () => void, reset: () => void) => <div className="absolute bottom-4 right-4 flex gap-1">
    <Button size="icon" variant="outline" aria-label="Zoom in" title="Zoom in" onClick={zoomIn}><Plus className="h-4 w-4" /></Button>
    <Button size="icon" variant="outline" aria-label="Zoom out" title="Zoom out" onClick={zoomOut}><Minus className="h-4 w-4" /></Button>
    <Button size="icon" variant="outline" aria-label="Reset world view" title="Reset world view" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
  </div>;
  return <div ref={host} className="activity-earth relative overflow-hidden" data-scene-ready={mode === "map" || ready ? "true" : undefined}>
    <div className="absolute left-4 top-4 z-10 flex gap-1">
      <Button variant={mode === "globe" ? "secondary" : "outline"} size="icon" disabled={!webgl} title="3D globe" aria-label="3D globe" onClick={() => { setReady(false); setMode("globe"); }}><Globe2 className="h-4 w-4" /></Button>
      <Button variant={mode === "map" ? "secondary" : "outline"} size="icon" title="World map" aria-label="World map" onClick={() => setMode("map")}><Map className="h-4 w-4" /></Button>
      {mode === "globe" && <Button variant="outline" size="icon" title={rotating ? "Pause rotation" : "Rotate globe"} aria-label={rotating ? "Pause rotation" : "Rotate globe"} onClick={() => setRotating(v => !v)}>{rotating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>}
    </div>
    {mode === "globe" ? <>
      <Globe ref={globe} width={width} height={460} backgroundColor={palette.ocean} globeMaterial={material} showAtmosphere={false} showGraticules
        polygonsData={countries} polygonCapColor={() => palette.land} polygonSideColor={() => palette.land} polygonStrokeColor={() => palette.border} polygonAltitude={0.001} polygonsTransitionDuration={0}
        pointsData={points} pointColor={p => color(p as ActivityPoint)} pointRadius={0.35} pointAltitude={0.015} pointsTransitionDuration={0}
        onPointClick={p => setSelected(p as ActivityPoint)}
        onGlobeReady={() => { globe.current?.pointOfView({ lat: 20, lng: 78, altitude: 2.3 }, 0); setReady(true); }} />
      {controls(() => zoom(0.8), () => zoom(1.25), () => globe.current?.pointOfView({ lat: 20, lng: 78, altitude: 2.3 }, 300))}
    </> : <TransformWrapper minScale={1} maxScale={5} centerOnInit>
      {({ zoomIn, zoomOut, resetTransform }) => <>
        <TransformComponent wrapperStyle={{ width: "100%", height: 460 }} contentStyle={{ width: "100%", height: "100%" }}>
          <svg viewBox="0 0 1000 500" width="100%" height="100%" role="img" aria-label="World map with purchase and visitor locations">
            {countries.map((c, i) => <path key={i} d={path(c) || ""} fill={palette.land} stroke={palette.border} strokeWidth={0.6} />)}
            {points.map((p, i) => { const xy = projection([p.lng, p.lat]); return xy ? <circle key={i} cx={xy[0]} cy={xy[1]} r={4} fill={color(p)} onClick={() => setSelected(p)}><title>{p.label}: {p.count} {p.kind === "order" ? "orders" : "visitors"}</title></circle> : null; })}
          </svg>
        </TransformComponent>
        {controls(() => zoomIn(), () => zoomOut(), () => resetTransform())}
      </>}
    </TransformWrapper>}
    {selected && <div className="absolute bottom-4 left-4 max-w-[55%] rounded border bg-card px-3 py-2 text-xs text-card-foreground"><p className="font-semibold">{selected.label}</p><p>{selected.count} {selected.kind === "order" ? "orders · last 24h" : "active visitors"}</p></div>}
  </div>;
}