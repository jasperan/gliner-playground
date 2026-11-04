"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { fetchEntities, checkBackend, type Entity } from "@/lib/api";
import { DEMO_ENTITIES } from "@/lib/demo";
import { Foot, Status } from "./parts";

const INKS = ["ink-a", "ink-b", "ink-c", "ink-d", "ink-e", "ink-f"];

const PRESETS = [
  {
    name: "Support ticket",
    text: "Hi, I'm Sarah Chen from Acme Corp. My order #A-4471 arrived damaged. Call me at +1 415 555 0132 or email sarah.chen@acme.com.",
    labels: ["person", "company", "order_number", "email_address", "phone_number"],
  },
  {
    name: "News lede",
    text: "Apple CEO Tim Cook announced the iPhone 15 in Cupertino on Tuesday, a week after Microsoft unveiled its Surface lineup in Redmond.",
    labels: ["person", "company", "product", "location"],
  },
  {
    name: "Clinical note",
    text: "Patient was started on metformin 500mg twice daily for type 2 diabetes; HbA1c measured at 8.1% during the visit on 12 March.",
    labels: ["drug", "condition", "dosage", "measurement"],
  },
  {
    name: "Contract clause",
    text: "The Supplier shall deliver the Goods to the Buyer's warehouse in Rotterdam no later than 30 June 2024, failing which a penalty of EUR 12,000 applies.",
    labels: ["party", "location", "date", "amount"],
  },
];

const MODEL_PARAMS: Record<string, string> = {
  "fastino/gliner2-base-v1": "205M",
  "fastino/gliner2-multi-v1": "205M",
  "urchade/gliner_small-v2.1": "64M",
  "gliner-community/gliner_medium-v2.5": "169M",
  "urchade/gliner_multi-v2.1": "169M",
};

function labelInk(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return INKS[h % INKS.length];
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
    <p className="passage">
      {parts.map((part, i) =>
        part.entity ? (
          <mark
            key={i}
            className={`mark ${labelInk(part.entity.label)}`}
            title={`${part.entity.label} · ${(part.entity.confidence * 100).toFixed(1)}%`}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
      {entities.length === 0 && <span className="instrument">no spans above this threshold</span>}
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runInference(), 350);
    return () => clearTimeout(debounceRef.current);
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

  const legend = [...new Set(entities.map((e) => e.label))];

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">zero-shot-ner</span>
        <span style={{ marginLeft: "auto" }} className="instrument">
          {entities.length} spans
        </span>
        <Status live={live} />
      </div>

      <div className="widget-body">
        <div className="field-row">
          {PRESETS.map((p, i) => (
            <button key={p.name} className="chip" onClick={() => applyPreset(i)}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="stack">
          <div className="label-row">
            <span className="label">Input text</span>
            <span className="instrument">{text.length} chars</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="field"
            placeholder="Type or paste any text…"
          />
        </div>

        <div className="stack">
          <div className="label-row">
            <span className="label">Entity types</span>
            <span className="instrument">click a label to remove it</span>
          </div>
          <div className="field-row">
            {labels.map((label) => (
              <button key={label} onClick={() => removeLabel(label)} className="chip" title={`Remove “${label}”`}>
                <span className={`swatch ${labelInk(label)}`} />
                {label}
                <X size={11} strokeWidth={1.5} className="chip-x" aria-hidden />
              </button>
            ))}
            {labels.length === 0 && <span className="instrument">add a label</span>}
          </div>
          <div className="field-row">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel();
                }
              }}
              placeholder="add a label, e.g. email_address"
              className="field"
              style={{ flex: "1 1 200px" }}
            />
            <button className="btn" onClick={addLabel}>
              <Plus size={13} strokeWidth={1.5} aria-hidden />
              Add
            </button>
          </div>
        </div>

        <div className="field-row" style={{ gap: 20 }}>
          <label className="field-row" style={{ flex: "1 1 220px" }}>
            <span className="label">threshold</span>
            <input
              type="range"
              min={0.1}
              max={0.95}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 100 }}
              aria-label="Confidence threshold"
            />
            <span className="instrument tnum" style={{ color: "var(--text)" }}>
              {threshold.toFixed(2)}
            </span>
          </label>
          <label className="field-row" style={{ flex: "1 1 220px" }}>
            <span className="label">model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="field" style={{ flex: 1 }}>
              <option value="fastino/gliner2-base-v1">GLiNER2 base (en)</option>
              <option value="fastino/gliner2-multi-v1">GLiNER2 multi (6 langs)</option>
              <option value="urchade/gliner_small-v2.1">GLiNER small v2.1</option>
              <option value="gliner-community/gliner_medium-v2.5">GLiNER medium v2.5</option>
              <option value="urchade/gliner_multi-v2.1">GLiNER multi v2.1</option>
            </select>
          </label>
        </div>

        <hr className="rule" />

        <div className="label-row">
          <span className="label">Extracted entities</span>
          {loading && <span className="instrument">running</span>}
        </div>

        <div className="well">
          <HighlightedText text={text} entities={entities} />
        </div>

        {legend.length > 0 && (
          <div className="legend">
            {legend.map((label) => (
              <span key={label} className="legend-item">
                <span className={`swatch ${labelInk(label)}`} />
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="ladder" key={runId}>
          {entities.length === 0 && (
            <div className="instrument">Nothing found — lower the threshold or add a label.</div>
          )}
          {entities.map((e, i) => (
            <div className="ladder-row row-fade" key={`${e.label}-${e.text}-${i}`}>
              <span className="ladder-name">{e.text}</span>
              <span className="ladder-tag">{e.label}</span>
              <div className="meter meter-accent">
                <span style={{ width: `${e.confidence * 100}%` }} />
              </div>
              <span className="ladder-score">{(e.confidence * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <Foot items={[model, `${MODEL_PARAMS[model] ?? "—"} params`, latency != null ? `${latency.toFixed(0)} ms` : null]} />
    </div>
  );
}
