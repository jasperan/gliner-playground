"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { checkBackend, fetchRelations } from "@/lib/api";
import { DEMO_RELATIONS } from "@/lib/demo";
import { Foot, Status } from "./parts";

type Rel = {
  relation: string;
  head: string;
  head_confidence: number;
  tail: string;
  tail_confidence: number;
};

const SENTENCE =
  "John works for Apple Inc. and lives in San Francisco. Emily Carter works for Fastino Labs in Paris. Apple Inc. and Microsoft compete closely.";

type Node = { id: string; label: string; kind: "person" | "org" | "place"; x: number; y: number };

function layout(rels: Rel[]): { nodes: Node[]; edges: { from: number; to: number; relation: string }[] } {
  const nodeMap = new Map<string, { label: string; kind: Node["kind"] }>();
  const add = (name: string, kind: Node["kind"]) => {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, { label: name, kind });
    }
  };
  const edges: { from: number; to: number; relation: string }[] = [];
  for (const r of rels) {
    const isPersonHead = /John|Sarah|Emily|Carter|Cook|Musk/i.test(r.head);
    add(r.head, isPersonHead ? "person" : "org");
    add(r.tail, /Apple|Microsoft|Google|Fastino|Acme/i.test(r.tail) ? "org" : "place");
    edges.push({ from: [...nodeMap.keys()].indexOf(r.head), to: [...nodeMap.keys()].indexOf(r.tail), relation: r.relation });
  }
  const names = [...nodeMap.keys()];
  const n = names.length;
  const nodes: Node[] = names.map((name, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: name,
      label: name,
      kind: nodeMap.get(name)!.kind,
      x: 450 + Math.cos(angle) * 330,
      y: 156 + Math.sin(angle) * 96,
    };
  });
  return { nodes, edges };
}

const KIND_INK: Record<Node["kind"], string> = {
  person: "#6ea3a0",
  org: "#8f8bc0",
  place: "#8ea86b",
};

const KIND_LABEL: Record<Node["kind"], string> = {
  person: "person",
  org: "organization",
  place: "place",
};

export default function RelationGraphWidget() {
  const [rels, setRels] = useState<Rel[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);

  const run = useCallback(async () => {
    setLoading(true);
    const t0 = performance.now();
    let found: Rel[] = [];
    try {
      if (await checkBackend()) {
        found = (await fetchRelations(SENTENCE, ["works_for", "lives_in", "competes_with"])).relations;
        setLive(true);
      } else {
        found = DEMO_RELATIONS(SENTENCE).relations;
        setLive(false);
      }
    } catch {
      found = DEMO_RELATIONS(SENTENCE).relations;
      setLive(false);
    }
    setRels(found);
    setDuration(Math.round(performance.now() - t0));
    setLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const { nodes, edges } = layout(rels);

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">relations</span>
        <span className="instrument" style={{ marginLeft: "auto" }}>
          {nodes.length} nodes · {edges.length} edges
        </span>
        <button className="btn" style={{ height: 28, padding: "0 10px" }} onClick={run} disabled={loading}>
          <RotateCcw size={12} strokeWidth={1.5} aria-hidden />
          Re-run
        </button>
        <Status live={live} />
      </div>

      <div className="widget-body">
        <div className="well">
          <p className="passage" style={{ maxHeight: "none", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
            {SENTENCE}
          </p>
        </div>

        <div className="well" style={{ padding: 0, overflow: "hidden" }}>
          <svg viewBox="0 0 900 320" className="graph" role="img" aria-label="Relation graph">
            {edges.map((e, i) => {
              const from = nodes[e.from];
              const to = nodes[e.to];
              if (!from || !to) return null;
              const active = hovered !== null && (hovered === e.from || hovered === e.to);
              return (
                <g key={i} opacity={hovered === null || active ? 1 : 0.2}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={active ? "rgba(239,233,222,0.4)" : "rgba(239,233,222,0.16)"}
                    strokeWidth={1}
                  />
                  <text
                    x={(from.x + to.x) / 2 + 6}
                    y={(from.y + to.y) / 2 - 6}
                    fontSize={10}
                    fill={active ? "var(--text)" : "var(--text-3)"}
                    fontFamily="var(--font-mono)"
                  >
                    {e.relation}
                  </text>
                </g>
              );
            })}
            {nodes.map((node, i) => {
              const ink = KIND_INK[node.kind];
              const isActive = hovered === null || hovered === i;
              return (
                <g
                  key={node.id}
                  opacity={isActive ? 1 : 0.25}
                  style={{ cursor: "pointer", transition: "opacity 160ms var(--ease)" }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={hovered === i ? 19 : 16}
                    fill={`color-mix(in srgb, ${ink} 24%, transparent)`}
                    stroke={`color-mix(in srgb, ${ink} 70%, transparent)`}
                    strokeWidth={1.25}
                    style={{ transition: "r 160ms var(--ease)" }}
                  />
                  <text
                    x={node.x}
                    y={node.y + 34}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--text)"
                    fontFamily="var(--font-mono)"
                  >
                    {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {loading && (
            <div className="instrument" style={{ padding: "0 12px 10px" }}>
              extracting relations
            </div>
          )}
        </div>

        <div className="legend">
          {(Object.keys(KIND_LABEL) as Node["kind"][]).map((kind) => (
            <span key={kind} className="legend-item">
              <span className="swatch" style={{ background: KIND_INK[kind] }} />
              {KIND_LABEL[kind]}
            </span>
          ))}
          <span className="instrument" style={{ marginLeft: "auto" }}>
            hover a node to isolate its relations
          </span>
        </div>

        {rels.length > 0 && (
          <div className="rel-grid">
            {rels.map((r, i) => (
              <div key={i} className="rel-card row-fade">
                <div className="rel-line">
                  <span className="ladder-name">{r.head}</span>
                  <span className="instrument">{r.relation}</span>
                  <span className="ladder-name">{r.tail}</span>
                </div>
                <div className="meter" style={{ marginTop: 6 }}>
                  <span style={{ width: `${Math.min(r.tail_confidence * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Foot items={["fastino/gliner2-base-v1", "205M params", duration > 0 ? `${duration} ms` : null]} />
    </div>
  );
}
