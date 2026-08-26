"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  MapPin,
  Route,
  Navigation,
  CheckCircle2,
  ClipboardList,
  X,
  Maximize2,
} from "lucide-react";

export type JourneyStop = {
  jobId: string;
  reference: string;
  postcode: string;
  city: string | null;
  address: string;
  preferred_time: string | null;
  preferred_date?: string;
  service_name: string;
  status: string;
  kind: "assigned" | "quoted";
  estimated_hours: number | null;
  lat: number | null;
  lng: number | null;
  sort_minutes: number;
  operative_en_route_at: string | null;
  operative_arrived_at: string | null;
  operative_marked_complete_at: string | null;
};

type DayRouteResponse = {
  date: string;
  base: { postcode: string; lat: number | null; lng: number | null } | null;
  stops: JourneyStop[];
  error?: string;
};

function fmtTime(t: string | null): string {
  if (!t) return "TBC";
  return t.slice(0, 5);
}

/** Local YYYY-MM-DD — toISOString() is UTC and shifts UK evenings/mornings. */
function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useDayRoute(date: string) {
  const [data, setData] = useState<DayRouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/contractor/jobs/day-route?date=${date}`, { credentials: "include" });
    const json = (await res.json()) as DayRouteResponse;
    if (!res.ok) {
      setError(json.error || "Could not load day route");
      setData(null);
    } else {
      setData(json);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

function useLeafletMap(
  mapEl: React.RefObject<HTMLDivElement | null>,
  data: DayRouteResponse | null,
  interactive: boolean,
  onStopClick?: (stop: JourneyStop) => void,
) {
  const mapRef = useRef<{ remove: () => void } | null>(null);

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

      type Pt = { lat: number; lng: number; label: string; kind: string; stop?: JourneyStop };
      const points: Pt[] = [];
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
            stop: s,
          });
        }
      }

      const center = points[0] || { lat: 51.5074, lng: -0.1278 };
      const map = L.map(mapEl.current, {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        attributionControl: interactive,
      }).setView([center.lat, center.lng], 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: interactive
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          : "",
        maxZoom: 19,
      }).addTo(map);

      const latLngs: [number, number][] = [];
      points.forEach((p, i) => {
        const color = p.kind === "base" ? "#64748b" : p.kind === "assigned" ? "#0891b2" : "#6366f1";
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:${interactive ? 28 : 18}px;height:${interactive ? 28 : 18}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font:700 ${interactive ? 11 : 9}px system-ui;">${p.kind === "base" ? "B" : String(i)}</div>`,
            iconSize: [interactive ? 28 : 18, interactive ? 28 : 18],
            iconAnchor: [interactive ? 14 : 9, interactive ? 14 : 9],
          }),
        }).addTo(map);
        if (interactive) {
          marker.bindPopup(p.label);
          if (p.stop && onStopClick) {
            marker.on("click", () => onStopClick(p.stop!));
          }
        }
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
              L.polyline(line, { color: "#0e7490", weight: interactive ? 4 : 3, opacity: 0.85 }).addTo(map);
            } else {
              L.polyline(latLngs, { color: "#0e7490", weight: 3, dashArray: "6 8" }).addTo(map);
            }
          } else {
            L.polyline(latLngs, { color: "#0e7490", weight: 3, dashArray: "6 8" }).addTo(map);
          }
        } catch {
          L.polyline(latLngs, { color: "#0e7490", weight: 3, dashArray: "6 8" }).addTo(map);
        }
      }

      if (latLngs.length) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [interactive ? 40 : 16, interactive ? 40 : 16] });
      }

      setTimeout(() => map.invalidateSize(), 80);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [data, interactive, mapEl, onStopClick]);
}

/** Compact map preview for an expanded calendar day. */
export function DayMapPreview({
  date,
  onOpenFull,
}: {
  date: string;
  onOpenFull: () => void;
}) {
  const { data, loading, error } = useDayRoute(date);
  const mapEl = useRef<HTMLDivElement | null>(null);
  useLeafletMap(mapEl, data, false);

  if (loading) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
    );
  }

  if (!data?.stops.length) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          No mapped stops for {date}. If jobs show below, open full journey view anyway.
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          <Maximize2 className="h-4 w-4" />
          Full journey view
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <div ref={mapEl} className="h-36 w-full pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={onOpenFull}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
      >
        <Maximize2 className="h-4 w-4" />
        Full journey view
      </button>
    </div>
  );
}

/** Full-screen / sheet journey view for mobile route review + job snapshots. */
export function DayJourneyFullView({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const { data, loading, error, reload } = useDayRoute(date);
  const [selected, setSelected] = useState<JourneyStop | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const onStopClick = useCallback((s: JourneyStop) => setSelected(s), []);
  useLeafletMap(mapEl, data, true, onStopClick);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 safe-pt">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Journey</p>
          <h2 className="text-lg font-bold text-slate-900">
            {new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : error ? (
        <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : (
        <>
          <div className="relative h-[42vh] min-h-[220px] shrink-0 border-b border-slate-200">
            <div ref={mapEl} className="absolute inset-0" />
            <p className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow">
              Tap a pin for job snapshot
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Route className="h-3.5 w-3.5 text-brand-600" />
              Stops in order
            </div>
            {!data?.stops.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No assigned or quoted jobs on {date}. If the calendar shows jobs that day, try
                refreshing — or check the job&apos;s preferred date matches this day.
              </div>
            ) : (
              <ol className="space-y-2">
                {data?.base && (
                  <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Start</p>
                    <p className="font-medium text-slate-900">Base · {data.base.postcode}</p>
                  </li>
                )}
                {(data?.stops || []).map((s, i) => (
                  <li key={s.jobId}>
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-brand-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-brand-700">
                            Stop {i + 1} · {fmtTime(s.preferred_time)}
                          </p>
                          <p className="font-semibold text-slate-900">{s.reference}</p>
                          <p className="text-xs text-slate-500">
                            {s.service_name} · {s.postcode}
                          </p>
                        </div>
                        <FieldChip stop={s} />
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}

      {selected && (
        <JobSnapshotSheet
          stop={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            reload();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function FieldChip({ stop }: { stop: JourneyStop }) {
  if (stop.operative_marked_complete_at) {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Done</span>;
  }
  if (stop.operative_arrived_at) {
    return <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">On site</span>;
  }
  if (stop.operative_en_route_at) {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">On the way</span>;
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        stop.kind === "assigned" ? "bg-cyan-50 text-cyan-800" : "bg-violet-50 text-violet-800"
      }`}
    >
      {stop.kind === "assigned" ? "Assigned" : "Quoted"}
    </span>
  );
}

function JobSnapshotSheet({
  stop,
  onClose,
  onUpdated,
}: {
  stop: JourneyStop;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canField = stop.kind === "assigned";

  const runField = async (action: "en_route" | "arrived" | "complete") => {
    setBusy(action);
    setErr(null);
    const res = await fetch(`/api/contractor/jobs/${stop.jobId}/field`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setErr(json.error || "Could not update status");
      return;
    }
    onUpdated();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[70] max-h-[70vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand-700">{fmtTime(stop.preferred_time)}</p>
          <h3 className="text-lg font-bold text-slate-900">{stop.reference}</h3>
          <p className="text-sm text-slate-600">{stop.service_name}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Address</dt>
          <dd className="text-right font-medium text-slate-900">
            {stop.address ? `${stop.address}, ` : ""}
            {stop.city ? `${stop.city} · ` : ""}
            {stop.postcode}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Map</dt>
          <dd>
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(stop.postcode)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-600"
            >
              <MapPin className="h-3.5 w-3.5" /> Open maps
            </a>
          </dd>
        </div>
      </dl>

      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

      {canField ? (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update customer</p>
          {!stop.operative_en_route_at && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => runField("en_route")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {busy === "en_route" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              I&apos;m on the way
            </button>
          )}
          {stop.operative_en_route_at && !stop.operative_arrived_at && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => runField("arrived")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {busy === "arrived" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              I&apos;ve arrived
            </button>
          )}
          {stop.operative_arrived_at && !stop.operative_marked_complete_at && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => runField("complete")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Log job complete
            </button>
          )}
          {stop.operative_marked_complete_at && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800">
              Completion logged — waiting for customer confirm if needed
            </p>
          )}
          <Link
            href={`/contractor/jobs/${stop.jobId}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" />
            Full job details &amp; notes
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
            Quoted only — field updates unlock once the customer accepts and you&apos;re assigned.
          </p>
          <Link
            href={`/contractor/jobs/${stop.jobId}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            View job
          </Link>
        </div>
      )}
    </div>
  );
}

/** Standalone page mode (legacy tab) — date picker + full journey. */
export default function DayJourneyMap({ initialDate }: { initialDate?: string }) {
  const [date, setDate] = useState(initialDate || localDayKey());
  const [open, setOpen] = useState(false);

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
          onClick={() => setOpen(true)}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Open full journey view
        </button>
      </div>
      <DayMapPreview date={date} onOpenFull={() => setOpen(true)} />
      {open && <DayJourneyFullView date={date} onClose={() => setOpen(false)} />}
    </div>
  );
}
