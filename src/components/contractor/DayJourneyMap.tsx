"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Route } from "lucide-react";

type Stop = {
  jobId: string;
  reference: string;
  postcode: string;
  city: string | null;
  address: string;
  preferred_time: string | null;
  service_name: string;
  kind: "assigned" | "quoted";
  estimated_hours: number | null;
  lat: number | null;
  lng: number | null;
  sort_minutes: number;
};

type DayRouteResponse = {
  date: string;
  base: { postcode: string; lat: number | null; lng: number | null } | null;
  stops: Stop[];
  error?: string;
};

function fmtTime(t: string | null): string {
  if (!t) return "TBC";
  return t.slice(0, 5);
}

export default function DayJourneyMap({ initialDate }: { initialDate?: string }) {
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DayRouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRouteError(null);
    const res = await fetch(`/api/contractor/jobs/day-route?date=${date}`, { credentials: "include" });
    const json = (await res.json()) as DayRouteResponse;
    if (!res.ok) {
      setRouteError(json.error || "Could not load day route");
      setData(null);
    } else {
      setData(json);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || !mapEl.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      if (cancelled || !mapEl.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const points: { lat: number; lng: number; label: string; kind: string }[] = [];
      if (data.base?.lat != null && data.base?.lng != null) {
        points.push({
          lat: data.base.lat,
          lng: data.base.lng,
          label: `Base · ${data.base.postcode}`,
          kind: "base",
        });
      }
      for (const s of data.stops) {
        if (s.lat != null && s.lng != null) {
          points.push({
            lat: s.lat,
            lng: s.lng,
            label: `${s.reference} · ${fmtTime(s.preferred_time)}`,
            kind: s.kind,
          });
        }
      }

      const center =
        points[0] ||
        ({ lat: 51.5074, lng: -0.1278 } as { lat: number; lng: number });

      const map = L.map(mapEl.current).setView([center.lat, center.lng], 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const latLngs: [number, number][] = [];
      points.forEach((p, i) => {
        const color = p.kind === "base" ? "#64748b" : p.kind === "assigned" ? "#0ea5e9" : "#6366f1";
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font:700 11px system-ui;">${p.kind === "base" ? "B" : String(i)}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(map);
        marker.bindPopup(p.label);
        latLngs.push([p.lat, p.lng]);
      });

      if (latLngs.length >= 2) {
        try {
          const coords = latLngs.map(([lat, lng]) => `${lng},${lat}`).join(";");
          const osrm = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
          );
          if (osrm.ok) {
            const routeJson = (await osrm.json()) as {
              routes?: { geometry?: { coordinates: [number, number][] } }[];
            };
            const geom = routeJson.routes?.[0]?.geometry?.coordinates;
            if (geom?.length) {
              const line = geom.map(([lng, lat]) => [lat, lng] as [number, number]);
              L.polyline(line, { color: "#0f766e", weight: 4, opacity: 0.85 }).addTo(map);
            } else {
              L.polyline(latLngs, { color: "#0f766e", weight: 3, dashArray: "6 8" }).addTo(map);
            }
          } else {
            L.polyline(latLngs, { color: "#0f766e", weight: 3, dashArray: "6 8" }).addTo(map);
          }
        } catch {
          L.polyline(latLngs, { color: "#0f766e", weight: 3, dashArray: "6 8" }).addTo(map);
        }
      }

      if (latLngs.length) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Day
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Plot journey"}
        </button>
        <p className="text-xs text-slate-500">
          Ordered by job time · Base → jobs · driving route via OpenStreetMap
        </p>
      </div>

      {routeError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{routeError}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            </div>
          ) : !data?.stops.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No assigned or quoted jobs on this day. Accept work or apply from Find a Job first.
            </div>
          ) : (
            <ol className="space-y-2">
              {data.base && (
                <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start</p>
                  <p className="font-medium text-slate-900">Base · {data.base.postcode}</p>
                </li>
              )}
              {data.stops.map((s, i) => (
                <li key={s.jobId} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-brand-700">
                        Stop {i + 1} · {fmtTime(s.preferred_time)}
                      </p>
                      <p className="font-semibold text-slate-900">{s.reference}</p>
                      <p className="text-xs text-slate-500">
                        {s.service_name} · {s.postcode}
                        {s.city ? ` · ${s.city}` : ""}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          s.kind === "assigned" ? "bg-cyan-50 text-cyan-800" : "bg-violet-50 text-violet-800"
                        }`}
                      >
                        {s.kind === "assigned" ? "Assigned" : "Quoted"}
                      </span>
                    </div>
                    <Link href={`/contractor/jobs/${s.jobId}`} className="text-xs font-semibold text-brand-600 hover:underline">
                      Open
                    </Link>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <MapPin className="h-3 w-3" />
                    {s.lat != null ? "Mapped" : "Could not geocode postcode"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
            <Route className="h-3.5 w-3.5 text-brand-600" />
            Journey map
          </div>
          <div ref={mapEl} className="h-[420px] w-full" />
        </div>
      </div>
    </div>
  );
}
