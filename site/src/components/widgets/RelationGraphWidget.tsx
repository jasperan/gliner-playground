"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkBackend, fetchRelations } from "@/lib/api";
import { DEMO_RELATIONS } from "@/lib/demo";

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
      x: 160 + Math.cos(angle) * 130,
      y: 105 + Math.sin(angle) * 90,
    };
  });
  return { nodes, edges };
}

const KIND_COLOR: Record<Node["kind"], { fill: string; stroke: string; text: string }> = {
  person: { fill: "rgba(34,211,238,0.15)", stroke: "#22d3ee", text: "#67e8f9" },
  org: { fill: "rgba(167,139,250,0.15)", stroke: "#a78bfa", text: "#c4b5fd" },
  place: { fill: "rgba(74,222,128,0.15)", stroke: "#4ade80", text: "#86efac" },
};

export default function RelationGraphWidget() {
  const [rels, setRels] = useState<Rel[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (timersRef.current) clearTimeout(timersRef.current);
    };
  }, [run]);

  const { nodes, edges } = layout(rels);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Relation extraction graph</div>
        <div className="ml-auto flex items-center gap-2">
          {duration > 0 && <span className="text-[11px] font-mono text-cyan-300/80">{duration} ms</span>}
          <button className="btn-mono" onClick={run}>⟳ Re-run</button>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              live ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
            }`}
          >
            {live ? "● LIVE INFERENCE" : "● DEMO DATA"}
          </span>
        </div>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-zinc-300 font-mono">
        {SENTENCE}
      </div>

      <div className="bg-[#101014] border border-border rounded-lg overflow-hidden">
        <svg viewBox="0 0 320 210" className="w-full h-auto">
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.25)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          {edges.map((e, i) => {
            const from = nodes[e.from];
            const to = nodes[e.to];
            if (!from || !to) return null;
            const active = hovered !== null && (hovered === e.from || hovered === e.to);
            return (
              <g key={i} className="graph-node" opacity={hovered === null || active ? 1 : 0.25}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} strokeDasharray={hovered === e.from || hovered === e.to ? "0" : "4 3"} />
                <text
                  x={(from.x + to.x) / 2 + 6}
                  y={(from.y + to.y) / 2 - 6}
                  fontSize={9}
                  fill={hovered === e.from || hovered === e.to ? "#fbbf24" : "#71717a"}
                  fontFamily="monospace"
                  className={hovered === e.from || hovered === e.to ? "animate-slide-in" : ""}
                >
                  {e.relation}
                </text>
              </g>
            );
          })}
          {nodes.map((node, i) => {
            const c = KIND_COLOR[node.kind];
            const isActive = hovered === null || hovered === i;
            return (
              <g
                key={node.id}
                className="graph-node cursor-pointer"
                opacity={isActive ? 1 : 0.25}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle cx={node.x} cy={node.y} r={30} fill="url(#nodeGlow)" />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={hovered === i ? 24 : 20}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={hovered === i ? 2.5 : 1.5}
                />
                <text
                  x={node.x}
                  y={node.y + 3}
                  textAnchor="middle"
                  fontSize={node.label.length > 12 ? 8 : 9.5}
                  fill={c.text}
                  fontFamily="monospace"
                  fontWeight={600}
                >
                  {node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label}
                </text>
              </g>
            );
          })}
        </svg>
        {loading && <div className="text-center text-xs text-muted-foreground py-2 animate-pulse">extracting relations…</div>}
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> person</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> organization</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400" /> place</span>
        <span className="text-muted-foreground">hover a node to see its relations</span>
      </div>

      {rels.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rels.map((r, i) => (
            <div key={i} className="bg-muted/40 border border-border rounded px-3 py-2 text-xs font-mono animate-slide-in" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="text-amber-400">{r.head}</span>
              <span className="text-muted-foreground"> —{r.relation}→ </span>
              <span className="text-amber-400">{r.tail}</span>
              <div className="mt-1 h-1 bg-white/5 rounded-full"><div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${Math.min(r.tail_confidence * 100, 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}