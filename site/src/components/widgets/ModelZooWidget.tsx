"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { checkBackend, fetchCompare, MODEL_IDS, type CompareRow } from "@/lib/api";
import { DEMO_COMPARE } from "@/lib/demo";
import { Foot, Status } from "./parts";

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
  const [rows, setRows] = useState<CompareRow[]>([]);
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
        setRows(DEMO_COMPARE().results);
        setLive(false);
      }
    } catch {
      setRows(DEMO_COMPARE().results);
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
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">model-zoo</span>
        <button className="btn" style={{ marginLeft: "auto", height: 28, padding: "0 10px" }} onClick={run} disabled={running}>
          <RotateCcw size={12} strokeWidth={1.5} aria-hidden />
          {running ? "running" : "Run all"}
        </button>
        <Status live={live} />
      </div>

      <div className="widget-body">
        <div className="well">
          <p className="passage" style={{ maxHeight: "none", color: "var(--text)" }}>
            {SAMPLE}
          </p>
          <div className="instrument" style={{ marginTop: 6 }}>
            labels: {LABELS.join(", ")}
          </div>
        </div>

        {running && !rows.length ? (
          <p className="instrument">Loading models — the first run downloads weights.</p>
        ) : (
          <div className="stack">
            {rows.map((row) => {
              const meta = MODEL_META[row.model] ?? { name: row.model, params: "?", family: row.family };
              return (
                <div key={row.model} className="zoo-row">
                  <div className="zoo-head">
                    <span className="ladder-name" style={{ width: 168 }}>
                      {meta.name}
                    </span>
                    <span className="instrument">{meta.family}</span>
                    <span className="instrument tnum" style={{ width: 40 }}>
                      {meta.params}
                    </span>
                    <div className="meter" style={{ flex: 1, minWidth: 60 }}>
                      <span style={{ width: `${(row.latency_ms / maxLatency) * 100}%` }} />
                    </div>
                    <span className="ladder-score" style={{ width: 56 }}>
                      {row.latency_ms.toFixed(0)} ms
                    </span>
                  </div>
                  <div className="field-row" style={{ marginTop: 6 }}>
                    {row.entities.map((e, i) => (
                      <span key={i} className="tag">
                        {e.label} <span style={{ color: "var(--text)" }}>{e.text}</span>{" "}
                        <span className="tnum">{(e.confidence * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="note">
          Same sentence, same labels, five models. GLiNER2 is Fastino&apos;s unified successor — one checkpoint that also
          classifies, extracts JSON and finds relations. The classic GLiNER models are NER-only but still very fast.
        </p>
      </div>

      <Foot items={["5 checkpoints", `${rows.reduce((n, r) => n + r.entities.length, 0)} spans found`]} />
    </div>
  );
}
