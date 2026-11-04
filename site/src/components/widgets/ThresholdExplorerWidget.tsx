"use client";

import { useCallback, useEffect, useState } from "react";
import { checkBackend, fetchEntities, type Entity } from "@/lib/api";
import { DEMO_ENTITIES } from "@/lib/demo";
import { Foot, Status } from "./parts";

const FULL_TEXT =
  "Elon Musk founded SpaceX in 2002 and Tesla in 2003. Mark Zuckerberg leads Meta from Menlo Park. Satya Nadella runs Microsoft from Redmond. Jensen Huang is the CEO of Nvidia in Santa Clara.";
const LABELS = ["person", "company", "location", "date"];

export default function ThresholdExplorerWidget() {
  const [threshold, setThreshold] = useState(0.9);
  const [candidates, setCandidates] = useState<Entity[]>([]); // full span pool at floor threshold
  const [candidateSource, setCandidateSource] = useState<"live" | "demo">("demo");
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    let res: Entity[];
    try {
      if (await checkBackend()) {
        // ask the model for everything above a 0.05 floor — an honest "candidate span" pool
        const out = await fetchEntities(FULL_TEXT, LABELS, "fastino/gliner2-base-v1", 0.05);
        res = out.entities;
        setLatency(out.latency_ms);
        setCandidateSource("live");
      } else {
        const demo = DEMO_ENTITIES(FULL_TEXT, LABELS);
        res = demo.entities.filter((e) => e.confidence >= 0.05);
        setLatency(demo.latency_ms);
        setCandidateSource("demo");
      }
    } catch {
      const demo = DEMO_ENTITIES(FULL_TEXT, LABELS);
      res = demo.entities.filter((e) => e.confidence >= 0.05);
      setLatency(demo.latency_ms);
      setCandidateSource("demo");
    }
    setCandidates(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  // client-side filter so the slider is instant; candidates were fetched once at floor
  const visible = candidates.filter((e) => e.confidence >= threshold).sort((a, b) => b.confidence - a.confidence);
  const total = candidates.length;
  const kept = visible.length;
  const filteredPct = total > 0 ? Math.round(((total - kept) / total) * 100) : 0;

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">threshold</span>
        <span className="instrument" style={{ marginLeft: "auto" }}>
          pool at 0.05 floor
        </span>
        <Status live={candidateSource === "live"} />
      </div>

      <div className="widget-body">
        <div className="field-row">
          <span className="label" style={{ minWidth: 64 }}>
            threshold
          </span>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.025}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ flex: 1, minWidth: 140 }}
            aria-label="Confidence threshold"
          />
          <span className="instrument tnum" style={{ color: "var(--text)", fontSize: 14, minWidth: 36 }}>
            {threshold.toFixed(2)}
          </span>
        </div>

        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{total}</div>
            <div className="stat-label">candidate spans</div>
          </div>
          <div className="stat">
            <div className="stat-value">{loading ? "—" : kept}</div>
            <div className="stat-label">survive the threshold</div>
          </div>
          <div className="stat">
            <div className="stat-value">{filteredPct}%</div>
            <div className="stat-label">filtered out</div>
          </div>
        </div>

        <div className="well">
          <div className="label-row">
            <span className="label">
              What survives — {kept} of {total} spans
            </span>
            {loading && <span className="instrument">refresh</span>}
          </div>
          {visible.length === 0 ? (
            <p className="instrument" style={{ marginTop: 10 }}>
              Nothing survives at this threshold — no span is confident enough.
            </p>
          ) : (
            <div className="ladder" style={{ marginTop: 10 }}>
              {visible.map((e, i) => (
                <div key={`${e.text}-${i}`} className="ladder-row row-fade">
                  <span className="ladder-name">{e.text}</span>
                  <span className="ladder-tag">{e.label}</span>
                  <div className="meter">
                    <span style={{ width: `${e.confidence * 100}%` }} />
                  </div>
                  <span className="ladder-score">{(e.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="note">
          The candidate pool was fetched once at a 0.05 floor — every span the model will even consider. The slider keeps
          only the ones above it: low is recall (grab everything, risk noise), high is precision (only confident spans,
          risk misses). Production pipelines tune this per entity type.
        </p>
      </div>

      <Foot items={["fastino/gliner2-base-v1", "205M params", latency != null ? `${latency.toFixed(0)} ms` : null]} />
    </div>
  );
}
