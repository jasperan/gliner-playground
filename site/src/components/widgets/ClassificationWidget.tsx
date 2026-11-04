"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkBackend, fetchClassification, type Classification } from "@/lib/api";
import { DEMO_CLASSIFY } from "@/lib/demo";
import { Foot, Status } from "./parts";

const TASKS: Record<string, string[]> = {
  sentiment: ["positive", "negative", "neutral"],
  topic: ["tech", "business", "finance", "health"],
  intent: ["request", "complaint", "information", "purchase"],
};

const REVIEWS = [
  "This laptop has amazing performance but terrible battery life!",
  "The service was terrible and the food was cold, I want a refund.",
  "Can you tell me the price of the 512GB model with AppleCare?",
  "Nice phone, great camera, would buy again.",
  "My GPU is overheating after just 10 minutes of gaming.",
];

type Task = "sentiment" | "topic" | "intent";

export default function ClassificationWidget() {
  const [text, setText] = useState(REVIEWS[0]);
  const [task, setTask] = useState<Task>("sentiment");
  const [results, setResults] = useState<Classification[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(async () => {
    setLoading(true);
    const tasks = { [task]: TASKS[task] };
    let classifications: Classification[] = [];
    try {
      if (await checkBackend()) {
        const res = await fetchClassification(text, tasks);
        classifications = res.classifications;
        setLatency(res.latency_ms);
        setLive(true);
      } else {
        const demo = DEMO_CLASSIFY(text);
        classifications = demo.classifications.filter((c) => c.task === task) as Classification[];
        setLatency(demo.latency_ms);
        setLive(false);
      }
    } catch {
      const demo = DEMO_CLASSIFY(text);
      classifications = demo.classifications.filter((c) => c.task === task) as Classification[];
      setLatency(demo.latency_ms);
      setLive(false);
    }
    setResults(classifications);
    setLoading(false);
  }, [text, task]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 250);
    return () => clearTimeout(debounceRef.current);
  }, [run]);

  const winner = results[0];
  const winnerConf = winner?.confidence ?? 0;

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">classify</span>
        <span className="instrument" style={{ marginLeft: "auto" }}>
          {task} · {TASKS[task].length} candidate labels
        </span>
        <Status live={live} />
      </div>

      <div className="widget-body">
        <div className="field-row">
          {(Object.keys(TASKS) as Task[]).map((t) => (
            <button key={t} className="chip" onClick={() => setTask(t)} aria-pressed={task === t}>
              {t}
            </button>
          ))}
        </div>

        <div className="split split-2" style={{ marginTop: 0 }}>
          <div className="stack">
            <div className="label-row">
              <span className="label">Input text</span>
              <span className="instrument">pick an example or edit it</span>
            </div>
            <select
              value={REVIEWS.includes(text) ? text : ""}
              onChange={(e) => e.target.value && setText(e.target.value)}
              className="field"
              aria-label="Example text"
            >
              <option value="">custom text</option>
              {REVIEWS.map((r) => (
                <option key={r} value={r}>
                  {r.length > 64 ? `${r.slice(0, 64)}…` : r}
                </option>
              ))}
            </select>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="field"
              placeholder="Type your own review, email, support ticket…"
            />
          </div>

          <div className="well">
            <div className="label-row">
              <span className="label">Prediction</span>
              {loading && <span className="instrument">classifying</span>}
            </div>
            {winner ? (
              <div style={{ marginTop: 12 }}>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {winner.label}
                </div>
                <div className="meter" style={{ marginTop: 10 }}>
                  <span style={{ width: `${winnerConf * 100}%` }} />
                </div>
                <div className="instrument tnum" style={{ marginTop: 6 }}>
                  confidence {(winnerConf * 100).toFixed(1)}%
                </div>
                <div className="field-row" style={{ marginTop: 16 }}>
                  {TASKS[task].map((label) => (
                    <span
                      key={label}
                      className="tag"
                      style={
                        label === winner.label
                          ? { color: "var(--text)", borderColor: "var(--hairline-2)", background: "var(--raised)" }
                          : undefined
                      }
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="instrument" style={{ marginTop: 12 }}>
                no prediction yet
              </p>
            )}
          </div>
        </div>
      </div>

      <Foot items={["fastino/gliner2-base-v1", "205M params", latency != null ? `${latency.toFixed(0)} ms` : null]} />
    </div>
  );
}
