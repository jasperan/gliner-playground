"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Foot } from "./parts";

/**
 * "How GLiNER works" — a walkthrough that shows tokens flowing through the
 * bidirectional encoder and the span-vs-label scoring head.
 * Pure client-side animation (no inference needed).
 */

type Stage = "tokens" | "encoder" | "scoring" | "output";

const STAGES: { key: Stage; title: string; sub: string }[] = [
  { key: "tokens", title: "Tokenize", sub: "split the text" },
  { key: "encoder", title: "Encode", sub: "all tokens at once" },
  { key: "scoring", title: "Score spans", sub: "span against label" },
  { key: "output", title: "Keep winners", sub: "above threshold" },
];

const TOKENS = ["Apple", "CEO", "Tim", "Cook", "announced", "the", "iPhone", "15", "in", "Cupertino"];

const SPANS = [
  { from: 0, to: 1, label: "company", conf: 0.99 },
  { from: 2, to: 4, label: "person", conf: 0.96 },
  { from: 6, to: 8, label: "product", conf: 0.93 },
  { from: 9, to: 10, label: "place", conf: 0.88 },
];

const SPAN_INKS = ["ink-a", "ink-b", "ink-c", "ink-d"];

const LABELS = ["company", "person", "product", "place"];

export default function HowGLiNERWorksWidget() {
  const [stage, setStage] = useState<Stage>("tokens");
  const [activeToken, setActiveToken] = useState(-1);
  const [labelIdx, setLabelIdx] = useState(-1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStage("tokens");
    setActiveToken(-1);
    setLabelIdx(-1);

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
  }, []);

  const stageIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">span-scorer</span>
        <button className="btn" style={{ marginLeft: "auto", height: 28, padding: "0 10px" }} onClick={play}>
          <RotateCcw size={12} strokeWidth={1.5} aria-hidden />
          Replay
        </button>
      </div>

      <div className="widget-body">
        {/* Pipeline stages */}
        <div className="stage-row">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className={`stage${i < stageIdx ? " stage-done" : ""}${i === stageIdx ? " stage-current" : ""}`}
            >
              <div className="stage-title">{s.title}</div>
              <div className="stage-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Token stream */}
        <div className="well">
          <div className="label">Tokens</div>
          <div className="token-row" style={{ marginTop: 8 }}>
            {TOKENS.map((tok, i) => {
              const spanIdx = SPANS.findIndex((s) => i >= s.from && i < s.to);
              const isSpan = spanIdx >= 0;
              const lit = i <= activeToken;
              return (
                <span
                  key={i}
                  className={`token ${lit ? "token-lit" : ""} ${lit && isSpan ? `token-span ${SPAN_INKS[spanIdx]}` : ""}`}
                >
                  {tok}
                </span>
              );
            })}
          </div>

          <div className="label" style={{ marginTop: 16 }}>
            Your labels, embedded like tokens
          </div>
          <div className="token-row" style={{ marginTop: 8 }}>
            {LABELS.map((label, i) => (
              <span key={label} className={`token ${labelIdx >= i && stage === "scoring" ? "token-lit" : ""}`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Output */}
        <div className="well">
          <div className="label-row">
            <span className="label">Span × label scores</span>
            {stage !== "output" && <span className="instrument">encoding</span>}
          </div>
          {stage !== "output" ? (
            <p className="instrument" style={{ marginTop: 10 }}>
              pairing spans with labels
            </p>
          ) : (
            <div className="ladder" style={{ marginTop: 10 }}>
              {SPANS.map((s, i) => (
                <div className="ladder-row row-fade" key={i}>
                  <span className="ladder-name">{TOKENS.slice(s.from, s.to).join(" ")}</span>
                  <span className={`tag ${SPAN_INKS[i % SPAN_INKS.length]}`}>{s.label}</span>
                  <div className="meter">
                    <span style={{ width: `${s.conf * 100}%` }} />
                  </div>
                  <span className="ladder-score">{s.conf.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="note">
          The top (span, label) pairs above your threshold become the highlighted entities in section 01.
        </p>
      </div>

      <Foot items={["simulation", `${TOKENS.length} tokens`, `${SPANS.length} spans kept`]} />
    </div>
  );
}
