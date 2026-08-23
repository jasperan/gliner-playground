"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "How GLiNER works" — an animated pipeline that shows tokens flowing
 * through the bidirectional encoder and the span-vs-label scoring head.
 * Pure client-side animation (no inference needed).
 */

type Stage = "tokens" | "encoder" | "scoring" | "output";

const STAGES: { key: Stage; title: string; sub: string }[] = [
  { key: "tokens", title: "Tokenize", sub: "split text into tokens" },
  { key: "encoder", title: "Encode", sub: "bidirectional transformer, all tokens at once" },
  { key: "scoring", title: "Score spans", sub: "match token spans ↔ your labels" },
  { key: "output", title: "Keep winners", sub: "above threshold = entities" },
];

const TOKENS = ["Apple", "CEO", "Tim", "Cook", "announced", "the", "iPhone", "15", "in", "Cupertino"];

const SPANS = [
  { from: 0, to: 1, label: "company", conf: 0.99 },
  { from: 2, to: 4, label: "person", conf: 0.96 },
  { from: 6, to: 8, label: "product", conf: 0.93 },
  { from: 9, to: 10, label: "place", conf: 0.88 },
];

const SPAN_COLORS = [
  { token: "bg-orange-500/30 text-zinc-100 border-orange-500/50", chip: "bg-orange-500/15 text-orange-300 border-orange-500/40" },
  { token: "bg-cyan-500/30 text-zinc-100 border-cyan-500/50", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  { token: "bg-purple-500/30 text-zinc-100 border-purple-500/50", chip: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
  { token: "bg-green-500/30 text-zinc-100 border-green-500/50", chip: "bg-green-500/15 text-green-300 border-green-500/40" },
];

const LABELS = ["company", "person", "product", "place"];

export default function HowGLiNERWorksWidget() {
  const [stage, setStage] = useState<Stage>("tokens");
  const [activeToken, setActiveToken] = useState(-1);
  const [labelIdx, setLabelIdx] = useState(-1);
  const [setNr, setSetNr] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStage("tokens");
    setActiveToken(-1);
    setLabelIdx(-1);
    setSetNr((n) => n + 1);

    // tokens light up one by one
    for (let i = 0; i < TOKENS.length; i++) {
      timersRef.current.push(setTimeout(() => setActiveToken(i), 250 + i * 130));
    }
    // encoder active
    timersRef.current.push(setTimeout(() => setStage("encoder"), 200 + TOKENS.length * 130));
    // label sweep
    LABELS.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => setLabelIdx(i), 2200 + i * 260));
    });
    timersRef.current.push(setTimeout(() => setStage("scoring"), 2200));
    // output
    timersRef.current.push(setTimeout(() => setStage("output"), 3400));
  };

  useEffect(() => {
    play();
    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · How GLiNER scores spans</div>
        <button className="btn-mono ml-auto" onClick={play}>⟳ Replay</button>
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex-1">
            <div
              className={`rounded-lg border px-2 py-2 text-center transition-all duration-300 ${
                i <= stageIdx ? "border-cyan-500/50 bg-cyan-500/10" : "border-border bg-muted/30"
              } ${i === stageIdx ? "ring-1 ring-cyan-500/40" : ""}`}
            >
              <div className="font-mono text-[11px] text-zinc-200">{s.title}</div>
              <div className="text-[10px] text-muted-foreground hidden sm:block mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Token stream */}
      <div className="bg-[#101014] border border-border rounded-lg p-4">
        <div className="text-[11px] font-mono text-muted-foreground mb-2">TOKENS</div>
        <div className="flex flex-wrap gap-1.5">
          {TOKENS.map((tok, i) => {
            const spanIdx = SPANS.findIndex((s) => i >= s.from && i < s.to);
            const isSpan = spanIdx >= 0;
            const lit = i <= activeToken;
            const tokenCls = isSpan ? SPAN_COLORS[spanIdx % SPAN_COLORS.length].token : "bg-white/10 text-zinc-200";
            return (
              <span
                key={i}
                className={`px-2 py-1 rounded font-mono text-xs transition-all duration-200 ${
                  !lit
                    ? "bg-white/5 text-zinc-500"
                    : `${tokenCls} border ${isSpan ? "" : "border-transparent"}`
                } ${stage === "scoring" && isSpan ? "scale-105" : ""}`}
              >
                {tok}
              </span>
            );
          })}
        </div>

        {/* Label candidates */}
        <div className="mt-4">
          <div className="text-[11px] font-mono text-muted-foreground mb-2">YOUR LABELS (embedded like tokens)</div>
          <div className="flex flex-wrap gap-1.5">
            {LABELS.map((label, i) => (
              <span
                key={label}
                className={`px-2 py-1 rounded font-mono text-xs transition-all duration-200 ${
                  labelIdx >= i && stage === "scoring"
                    ? "bg-purple-500/25 text-purple-200 border border-purple-500/50"
                    : "bg-white/5 text-zinc-500"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="bg-[#101014] border border-border rounded-lg p-4 min-h-[92px]">
        <div className="text-[11px] font-mono text-muted-foreground mb-2">SPAN × LABEL SCORES</div>
        {stage !== "output" ? (
          <div className="text-sm text-muted-foreground animate-pulse pt-2">encoding… pairing spans with labels…</div>
        ) : (
          <div className="space-y-1">
            {SPANS.map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm animate-slide-in" style={{ animationDelay: `${i * 150}ms` }}>
                <span className="font-mono text-xs text-zinc-300 w-28 truncate">{TOKENS.slice(s.from, s.to).join(" ")}</span>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${SPAN_COLORS[i % SPAN_COLORS.length].chip}`}>
                  {s.label}
                </span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-purple-500" style={{ width: `${s.conf * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted-foreground w-12 text-right">{s.conf.toFixed(2)}</span>
              </div>
            ))}
            <p key={setNr} className="text-[11px] text-muted-foreground mt-2">
              → The top (span, label) pairs above your threshold become the highlighted entities you saw in section 01.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}