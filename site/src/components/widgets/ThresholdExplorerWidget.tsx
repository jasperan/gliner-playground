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
  const [candidates, setCandidates] = useState<Entity[]>([]); // full span pool at floor threshold
  const [candidateSource, setCandidateSource] = useState<"live" | "demo">("demo");
  const [loading, setLoading] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    let res: Entity[];
    try {
      if (await checkBackend()) {
        // ask the model for everything above a 0.05 floor — an honest "candidate span" pool
        res = (await fetchEntities(FULL_TEXT, LABELS, "fastino/gliner2-base-v1", 0.05)).entities;
        setCandidateSource("live");
      } else {
        res = DEMO_ENTITIES(FULL_TEXT, LABELS).entities.filter((e) => e.confidence >= 0.05);
        setCandidateSource("demo");
      }
    } catch {
      res = DEMO_ENTITIES(FULL_TEXT, LABELS).entities.filter((e) => e.confidence >= 0.05);
      setCandidateSource("demo");
    }
    setCandidates(res);
    setPulseKey((k) => k + 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  // client-side filter so the slider is instant; candidates were fetched once at floor
  const visible = candidates.filter((e) => e.confidence >= threshold);
  const total = candidates.length;
  const kept = visible.length;
  const filteredPct = total > 0 ? Math.round(((total - kept) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Confidence threshold</div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              candidateSource === "live" ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
            }`}
            title={candidateSource === "live" ? "Span pool fetched live from the backend" : "Backend offline — using curated demo data"}
          >
            {candidateSource === "live" ? "● LIVE INFERENCE" : "● DEMO DATA"}
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
            {loading ? "…" : kept}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">survive threshold</div>
        </div>
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="font-mono text-2xl text-purple-400">{filteredPct}%</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">filtered out</div>
        </div>
      </div>

      <div key={pulseKey} className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="text-[11px] font-mono text-muted-foreground mb-2">
          WHAT SURVIVES ({kept} of {total} spans{loading ? " · refresh…" : ""})
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nothing survives at this threshold — the model has no span confident enough.
          </p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((e, i) => (
              <div key={`${e.text}-${i}`} className="flex items-center gap-2 text-sm animate-slide-in" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <span className={`font-mono text-xs w-20 shrink-0 ${COLOR[i % COLOR.length]}`}>{e.label}</span>
                <span className="text-zinc-200">{e.text}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden ml-2">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${e.confidence * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted-foreground w-12 text-right">{(e.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        The <span className="text-orange-400">candidate pool</span> here was fetched live at a 0.05 floor (every span the model will even consider); the slider keeps only the ones above it.{" "}
        <span className="text-orange-400">low</span> = recall (grab everything, risk noise), <span className="text-cyan-400">high</span> = precision (only confident spans, risk misses). Production pipelines tune this per entity type.
      </p>
    </div>
  );
}