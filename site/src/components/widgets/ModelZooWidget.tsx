"use client";

import { useCallback, useEffect, useState } from "react";
import { checkBackend, fetchCompare, MODEL_IDS } from "@/lib/api";
import { DEMO_COMPARE } from "@/lib/demo";

const SAMPLE = "Apple CEO Tim Cook announced the iPhone 15 in Cupertino.";
const LABELS = ["company", "person", "product", "location"];

const MODEL_META: Record<string, { name: string; params: string; family: string }> = {
  [MODEL_IDS.small]: { name: "GLiNER Small v2.1", params: "64M", family: "GLiNER" },
  [MODEL_IDS.medium]: { name: "GLiNER Medium v2.5", params: "169M", family: "GLiNER" },
  [MODEL_IDS.multi]: { name: "GLiNER Multi v2.1", params: "169M", family: "GLiNER" },
  [MODEL_IDS.g2base]: { name: "GLiNER2 Base v1", params: "205M", family: "GLiNER2" },
  [MODEL_IDS.g2multi]: { name: "GLiNER2 Multi v1", params: "205M", family: "GLiNER2" },
};

export default function ModelZooWidget() {
  const [rows, setRows] = useState<{ model: string; family: string; latency_ms: number; entities: { label: string; text: string; confidence: number }[] }[]>([]);
  const [live, setLive] = useState(false);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    const models = Object.values(MODEL_IDS);
    try {
      if (await checkBackend()) {
        const res = await fetchCompare(SAMPLE, LABELS, models);
        setRows(res.results);
        setLive(true);
      } else {
        setRows(DEMO_COMPARE().results as typeof rows);
        setLive(false);
      }
    } catch {
      setRows(DEMO_COMPARE().results as typeof rows);
      setLive(false);
    }
    setRunning(false);
  }, []);

  // auto-run on mount so the section is populated without a click
  useEffect(() => {
    run();
  }, [run]);

  const maxLatency = Math.max(...rows.map((r) => r.latency_ms), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Model zoo comparison</div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-mono" onClick={run} disabled={running}>
            {running ? "benchmarking…" : "⟳ Run all 5 models"}
          </button>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              live ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
            }`}
          >
            {live ? "● LIVE INFERENCE" : "● DEMO DATA"}
          </span>
        </div>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-zinc-400">
        <span className="text-zinc-200">{SAMPLE}</span>
        <div className="mt-1 text-[11px] font-mono text-muted-foreground">labels: {LABELS.join(", ")}</div>
      </div>

      {running && !rows.length ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading models (first run downloads weights)…</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const meta = MODEL_META[row.model] ?? { name: row.model, params: "?", family: row.family };
            const isGliner2 = meta.family === "GLiNER2";
            return (
              <div key={row.model} className="bg-muted/40 border border-border rounded-lg p-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono w-44 shrink-0 text-zinc-200">{meta.name}</span>
                  <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${isGliner2 ? "border-purple-500/40 text-purple-300 bg-purple-500/10" : "border-cyan-500/30 text-cyan-300 bg-cyan-500/10"}`}>
                    {meta.family}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">{meta.params}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                      style={{ width: `${(row.latency_ms / maxLatency) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-cyan-300 w-16 text-right">{row.latency_ms.toFixed(0)} ms</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {row.entities.map((e, i) => (
                    <span key={i} className="text-[11px] font-mono border border-border rounded px-1.5 py-0.5 text-zinc-300">
                      {e.label}: <span className="text-zinc-100">{e.text}</span>{" "}
                      <span className="text-muted-foreground">{(e.confidence * 100).toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Same sentence, same labels, five models. <span className="text-purple-300">GLiNER2</span> is Fastino&apos;s unified successor — one checkpoint that also classifies, extracts JSON and finds relations. The classic{" "}
        <span className="text-cyan-300">GLiNER</span> models are NER-only but still very fast.
      </p>
    </div>
  );
}