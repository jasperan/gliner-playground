"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkBackend, fetchEntities, type Entity } from "@/lib/api";
import { DEMO_ENTITIES } from "@/lib/demo";

const FULL_TEXT =
  "Elon Musk founded SpaceX in 2002 and Tesla in 2003. Mark Zuckerberg leads Meta from Menlo Park. Satya Nadella runs Microsoft from Redmond. Jensen Huang is the CEO of Nvidia in Santa Clara.";
const LABELS = ["person", "company", "location", "date"];

const COLOR = ["text-orange-400", "text-cyan-400", "text-green-400", "text-purple-400"];

export default function ThresholdExplorerWidget() {
  const [threshold, setThreshold] = useState(0.35);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    let res: Entity[];
    try {
      if (await checkBackend()) {
        res = (await fetchEntities(FULL_TEXT, LABELS, "fastino/gliner2-base-v1", threshold)).entities;
        setLive(true);
      } else {
        res = DEMO_ENTITIES(FULL_TEXT, LABELS).entities.filter((e) => e.confidence >= threshold);
        setLive(false);
      }
    } catch {
      res = DEMO_ENTITIES(FULL_TEXT, LABELS).entities.filter((e) => e.confidence >= threshold);
      setLive(false);
    }
    setEntities(res);
    setPulseKey((k) => k + 1);
    setLoading(false);
  }, [threshold]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [run]);

  const kept = entities.length;
  const total = DEMO_ENTITIES(FULL_TEXT, LABELS).entities.length + 6; // demo total
  const fromBackend = entities.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Confidence threshold</div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              live ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
            }`}
          >
            {live ? "● LIVE INFERENCE" : "● DEMO DATA"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-muted-foreground w-20">threshold</span>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.025}
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="font-mono text-lg text-cyan-300 w-16 text-right">{threshold.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="font-mono text-2xl text-orange-400">{total}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">candidate spans</div>
        </div>
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className={`font-mono text-2xl ${loading ? "text-muted-foreground" : "text-cyan-400"}`}>
            {loading ? "…" : fromBackend}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">survive threshold</div>
        </div>
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="font-mono text-2xl text-purple-400">{Math.round(((total - fromBackend) / Math.max(total, 1)) * 100)}%</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">filtered out</div>
        </div>
      </div>

      <div key={pulseKey} className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="text-[11px] font-mono text-muted-foreground mb-2">
          WHAT SURVIVES ({kept} entities{loading ? " · refresh…" : ""})
        </div>
        {entities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nothing survives at this threshold — the model has no span confident enough.
          </p>
        ) : (
          <div className="space-y-1.5">
            {entities.map((e, i) => (
              <div key={`${e.text}-${i}`} className="flex items-center gap-2 text-sm animate-slide-in" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <span className={`font-mono text-xs w-20 shrink-0 ${COLOR[i % COLOR.length]}`}>{e.label}</span>
                <span className="text-zinc-200">{e.text}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden ml-2">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${e.confidence * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted-foreground w-12 text-right">{(e.confidence * 100).toFixed(0)}%</span>
                {e.confidence < threshold && <span className="text-red-400 text-xs">✕</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Move the slider: <span className="text-orange-400">low</span> = recall (grab everything, risk noise),{" "}
        <span className="text-cyan-400">high</span> = precision (only confident spans, risk misses). Production pipelines tune this per entity type.
      </p>
    </div>
  );
}