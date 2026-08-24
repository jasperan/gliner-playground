"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEntities, checkBackend, type Entity } from "@/lib/api";
import { DEMO_ENTITIES } from "@/lib/demo";

const COLOR_CLASSES = ["ent-a", "ent-b", "ent-c", "ent-d", "ent-e", "ent-f"];

const PRESETS = [
  {
    name: "Apple announcement",
    text: "Apple CEO Tim Cook announced the iPhone 15 in Cupertino, California.",
    labels: ["company", "person", "product", "location"],
  },
  {
    name: "Startup founders",
    text: "Elon Musk founded SpaceX in 2002 and Tesla in 2003, and now runs X in Austin.",
    labels: ["person", "company", "city"],
  },
  {
    name: "Medical note",
    text: "Patient Jane Smith, 45, was prescribed Metformin 500mg for type 2 diabetes by Dr. Lee at St. Mary's Hospital.",
    labels: ["person", "drug", "condition", "hospital"],
  },
  {
    name: "PII redaction",
    text: "Hi, my order #48291 hasn't arrived. Contact me at john.doe@gmail.com or 555-0192.",
    labels: ["email_address", "phone_number", "order_number", "person_name"],
  },
];

function labelColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return COLOR_CLASSES[h % COLOR_CLASSES.length];
}

function HighlightedText({ text, entities }: { text: string; entities: Entity[] }) {
  // Handle overlapping spans deterministically: sort by start asc, then by
  // end desc (longer span wins), and skip spans nested inside an earlier one.
  const spans = entities
    .filter((e) => e.start != null && e.end != null && e.start >= 0 && e.end <= text.length && e.start < e.end)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || (b.end ?? 0) - (a.end ?? 0));

  const parts: { text: string; entity?: Entity }[] = [];
  let cursor = 0;
  for (const e of spans) {
    const start = e.start ?? 0;
    const end = e.end ?? 0;
    if (start < cursor) continue; // overlap / nested span → skip
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: e.text, entity: e });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });

  return (
    <p className="text-[15px] leading-8 whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.entity ? (
          <mark
            key={i}
            className={`${labelColor(part.entity.label)} rounded px-0.5 py-0 font-medium`}
            title={`${part.entity.label} · ${(part.entity.confidence * 100).toFixed(1)}%`}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
      {entities.length === 0 && <span className="text-muted-foreground/60 italic">— no entities found at this threshold —</span>}
    </p>
  );
}

export default function ZeroShotNERWidget() {
  const [text, setText] = useState(PRESETS[0].text);
  const [labels, setLabels] = useState<string[]>(PRESETS[0].labels);
  const [newLabel, setNewLabel] = useState("");
  const [threshold, setThreshold] = useState(0.5);
  const [model, setModel] = useState("fastino/gliner2-base-v1");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(0);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const runInference = useCallback(async () => {
    const seq = ++requestSeq.current; // only the latest request may commit state
    setLoading(true);
    // checkBackend is memoized for 5s, so this is cheap even on every debounce.
    try {
      if (await checkBackend()) {
        const res = await fetchEntities(text, labels, model, threshold);
        if (seq !== requestSeq.current) return;
        setEntities(res.entities);
        setLatency(res.latency_ms);
        setLive(true);
      } else {
        const demo = DEMO_ENTITIES(text, labels);
        if (seq !== requestSeq.current) return;
        setEntities(demo.entities);
        setLatency(demo.latency_ms);
        setLive(false);
      }
      setRunId((r) => r + 1);
    } catch {
      if (seq !== requestSeq.current) return;
      const demo = DEMO_ENTITIES(text, labels);
      setEntities(demo.entities);
      setLatency(demo.latency_ms);
      setLive(false);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [text, labels, model, threshold]);

  // Debounced auto-run whenever inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runInference(), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runInference]);

  const addLabel = () => {
    const label = newLabel.trim().toLowerCase();
    if (!label) return;
    setLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setNewLabel("");
  };

  const removeLabel = (label: string) => setLabels((prev) => prev.filter((l) => l !== label));

  const applyPreset = (i: number) => {
    setText(PRESETS[i].text);
    setLabels(PRESETS[i].labels);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Zero-shot NER</div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              live ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
            }`}
            title={live ? "Running against the FastAPI backend (live inference)" : "Backend offline — using curated demo data"}
          >
            {live ? "● LIVE INFERENCE" : "● DEMO DATA"}
          </span>
          {latency != null && (
            <span className="text-[11px] font-mono text-cyan-300/80">{latency.toFixed(0)} ms</span>
          )}
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.name} className="chip" onClick={() => applyPreset(i)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input pane */}
        <div className="space-y-3">
          <div className="text-xs font-mono text-muted-foreground">INPUT TEXT</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full bg-muted/60 border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            placeholder="Type or paste any text…"
          />
          <div className="text-xs font-mono text-muted-foreground">
            ENTITY TYPES <span className="text-muted-foreground/60">(define them yourself — no training needed!)</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {labels.map((label) => (
              <button
                key={label}
                onClick={() => removeLabel(label)}
                className="chip active group"
                title="Click to remove"
              >
                <span className={labelColor(label)}>{label}</span>
                <span className="ml-1 text-muted-foreground group-hover:text-red-400">✕</span>
              </button>
            ))}
            {labels.length === 0 && <span className="text-xs text-muted-foreground">click ✕ to remove, or add new ones below</span>}
          </div>
          <div className="flex gap-2">
            <input
              ref={labelInputRef}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel();
                }
              }}
              placeholder="add a label… e.g. email_address"
              className="flex-1 bg-muted/60 border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-cyan-500/50"
            />
            <button className="btn-mono" onClick={addLabel}>
              + Add
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 text-muted-foreground">
              threshold
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-28"
              />
              <span className="font-mono text-cyan-300">{threshold.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-2 text-muted-foreground">
              model
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-muted border border-border rounded px-2 py-1 font-mono text-xs"
              >
                <option value="fastino/gliner2-base-v1">GLiNER2 base (en)</option>
                <option value="fastino/gliner2-multi-v1">GLiNER2 multi (6 langs)</option>
                <option value="urchade/gliner_small-v2.1">GLiNER small v2.1</option>
                <option value="gliner-community/gliner_medium-v2.5">GLiNER medium v2.5</option>
                <option value="urchade/gliner_multi-v2.1">GLiNER multi v2.1</option>
              </select>
            </label>
          </div>
        </div>

        {/* Output pane */}
        <div className="space-y-3">
          <div className="text-xs font-mono text-muted-foreground">
            EXTRACTED ENTITIES{" "}
            {loading && <span className="text-cyan-400/80 animate-pulse">· running…</span>}
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-3 min-h-[140px] max-h-[220px] overflow-y-auto">
            <HighlightedText text={text} entities={entities} />
          </div>
          <div key={runId} className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {entities.length === 0 && <div className="text-xs text-muted-foreground">Nothing found — try lowering the threshold or adding labels.</div>}
            {entities.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs animate-slide-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className={`${labelColor(e.label)} rounded px-1.5 py-0.5 font-mono w-28 text-center shrink-0`}>
                  {e.label}
                </span>
                <span className="font-mono text-sm text-foreground truncate max-w-[45%]">{e.text}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                    style={{ width: `${e.confidence * 100}%` }}
                  />
                </div>
                <span className="font-mono text-muted-foreground w-10 text-right">{(e.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}