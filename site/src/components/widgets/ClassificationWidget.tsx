"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkBackend, fetchClassification, type Classification } from "@/lib/api";
import { DEMO_CLASSIFY } from "@/lib/demo";

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

export default function ClassificationWidget() {
  const [text, setText] = useState(REVIEWS[0]);
  const [task, setTask] = useState<"sentiment" | "topic" | "intent">("sentiment");
  const [results, setResults] = useState<Classification[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    const tasks = { [task]: TASKS[task] };
    let classifications: Classification[] = [];
    try {
      if (await checkBackend()) {
        classifications = (await fetchClassification(text, tasks)).classifications;
        setLive(true);
      } else {
        const demo = DEMO_CLASSIFY(text).classifications.filter((c) => c.task === task) as Classification[];
        classifications = demo;
        setLive(false);
      }
    } catch {
      classifications = DEMO_CLASSIFY(text).classifications.filter((c) => c.task === task) as Classification[];
      setLive(false);
    }
    setResults(classifications);
    setLoading(false);
  }, [text, task]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [run]);

  const winner = results[0];
  const winnerConf = winner?.confidence ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Text classification</div>
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

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TASKS) as Array<"sentiment" | "topic" | "intent">).map((t) => (
          <button key={t} className={`chip ${task === t ? "active" : ""}`} onClick={() => setTask(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-mono text-muted-foreground">INPUT TEXT</div>
          <select
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm font-mono mb-2"
          >
            {REVIEWS.map((r) => (
              <option key={r} value={r}>
                {r.slice(0, 70)}…
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full bg-muted/60 border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-cyan-500/50"
            placeholder="Type your own review, email, support ticket…"
          />
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="text-[11px] font-mono text-muted-foreground mb-3">PREDICTION · {task}</div>
          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse">classifying…</div>
          ) : winner ? (
            <div className="space-y-2">
              <div
                className={`font-mono text-2xl ${
                  winner.label === "negative" || winner.label === "complaint"
                    ? "text-red-400"
                    : winner.label === "positive" || winner.label === "purchase" || winner.label === "request"
                      ? "text-green-400"
                      : "text-zinc-200"
                }`}
              >
                {winner.label}
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-cyan-500 to-purple-500 rounded-full"
                  style={{ width: `${winnerConf * 100}%` }}
                />
              </div>
              <div className="font-mono text-xs text-muted-foreground">confidence {(winnerConf * 100).toFixed(1)}%</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {TASKS[task].map((label) => (
                  <span
                    key={label}
                    className={`text-xs font-mono px-2 py-1 rounded border ${
                      label === winner.label
                        ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}