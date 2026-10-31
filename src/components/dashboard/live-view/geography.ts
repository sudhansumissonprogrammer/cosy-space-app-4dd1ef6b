import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { geoCentroid } from "d3-geo";
import atlas from "world-atlas/countries-110m.json";
import cities from "./india-cities.json";

const topology = atlas as unknown as Topology<{ countries: GeometryCollection }>;
export const countries = feature(topology, topology.objects.countries).features;
export interface ActivityPoint { lat: number; lng: number; label: string; count: number; kind: "order" | "visitor" }
const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function orderPoint(city: string | null, state: string | null, count: number): ActivityPoint | null {
  if (!city) return null;
  const name = normalize(city);
  const aliases: Record<string, string> = { bangalore: "bengaluru", bombay: "mumbai", calcutta: "kolkata", gurgaon: "gurugram", madras: "chennai" };
  const target = aliases[name] || name;
  let matches = cities.filter(c => c.names.includes(target));
  if (state) matches = matches.filter(c => normalize(c.state) === normalize(state));
  if (matches.length !== 1) return null;
  const c = matches[0];
  return { lat: c.lat, lng: c.lng, label: `${c.name}, ${c.state}`, count, kind: "order" };
}
export function visitorPoint(country: string | null, count: number): ActivityPoint | null {
  if (!country || !/^[A-Z]{2}$/.test(country)) return null;
  const name = new Intl.DisplayNames(["en"], { type: "region" }).of(country);
  const aliases: Record<string,string> = { "United States": "United States of America", "Congo - Kinshasa": "Dem. Rep. Congo", "Congo - Brazzaville": "Congo" };
  const boundary = countries.find(c => c.properties?.name === (aliases[name || ""] || name));
  if (!boundary) return null;
  const [lng, lat] = geoCentroid(boundary);
  return { lat, lng, label: `${name} · country-level`, count, kind: "visitor" };
}