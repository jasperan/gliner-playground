"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkBackend, fetchStructured } from "@/lib/api";
import { DEMO_STRUCTURED } from "@/lib/demo";

type JsonView = Record<string, any>;

type StructureMap = {
  product?: string[];
  contact?: string[];
  person?: string[];
};

const PRESETS: { name: string; text: string; structures: StructureMap }[] = [
  {
    name: "Product listing",
    text: "The iPhone 15 Pro Max with 256GB storage is priced at $1199 and has a 6.7-inch screen. Free shipping over $50.",
    structures: {
      product: [
        "name::str::Product name and model",
        "storage::str::Storage capacity",
        "price::str::Retail price",
        "screen::str::Screen size",
      ],
    },
  },
  {
    name: "Contact extraction",
    text: "You can reach Dr. Emily Carter at emily@fastino.ai or +33 6 12 34 56 78 for an appointment at the Cardiology department.",
    structures: {
      contact: ["email::str::Email address", "phone::str::Phone number"],
      person: ["name::str::Full name", "department::str::Medical department"],
    },
  },
];

// lightweight JSON syntax renderer
function JsonNode({ data, depth = 0 }: { data: any; depth?: number }) {
  const indent = "  ".repeat(depth);
  if (data === null || data === undefined) return <span className="json-bracket">null</span>;
  if (typeof data === "number") return <span className="json-number">{data}</span>;
  if (typeof data === "string") return <span className="json-string">"{data}"</span>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="json-bracket">[]</span>;
    return (
      <span>
        <span className="json-bracket">[</span>
        {data.map((item, i) => (
          <span key={i}>
            <br />
            {indent}  <JsonNode data={item} depth={depth + 1} />
            {i < data.length - 1 && <span className="json-bracket">,</span>}
          </span>
        ))}
        <br />
        {indent}<span className="json-bracket">]</span>
      </span>
    );
  }
  const entries = Object.entries(data);
  if (entries.length === 0) return <span className="json-bracket">{`{}`}</span>;
  return (
    <span>
      <span className="json-bracket">{`{`}</span>
      {entries.map(([k, v], i) => (
        <span key={k}>
          <br />
          {indent}  <span className="json-key">"{k}"</span>
          <span className="json-bracket">: </span>
          <JsonNode data={v} depth={depth + 1} />
          {i < entries.length - 1 && <span className="json-bracket">,</span>}
        </span>
      ))}
      <br />
      {indent}<span className="json-bracket">{`}`}</span>
    </span>
  );
}

export default function StructuredExtractionWidget() {
  const [preset, setPreset] = useState(0);
  const [text, setText] = useState(PRESETS[0].text);
  const [structures, setStructures] = useState<Record<string, string[]>>(PRESETS[0].structures);
  const [data, setData] = useState<JsonView | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      if (await checkBackend()) {
        const res = await fetchStructured(text, structures);
        setData(res.data as JsonView);
        setLatency(res.latency_ms);
        setLive(true);
      } else {
        const demo = DEMO_STRUCTURED(text);
        setData(demo.data as JsonView);
        setLatency(demo.latency_ms);
        setLive(false);
      }
    } catch {
      const demo = DEMO_STRUCTURED(text);
      setData(demo.data as JsonView);
      setLatency(demo.latency_ms);
      setLive(false);
    }
    setLoading(false);
  }, [text, structures]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [run]);

  const applyPreset = (i: number) => {
    setPreset(i);
    setText(PRESETS[i].text);
    setStructures(PRESETS[i].structures);  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Interactive · Messy text → structured JSON</div>
        <div className="ml-auto flex items-center gap-2">
          {latency != null && <span className="text-[11px] font-mono text-cyan-300/80">{latency.toFixed(0)} ms</span>}
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
        {PRESETS.map((p, i) => (
          <button key={p.name} className={`chip ${i === preset ? "active" : ""}`} onClick={() => applyPreset(i)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-mono text-muted-foreground">RAW INPUT (human-flavored)</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full bg-muted/60 border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-cyan-500/50"
          />
          <div className="text-[11px] font-mono text-muted-foreground">SCHEMA (field::dtype::description)</div>
          <div className="bg-muted/40 border border-border rounded p-2 font-mono text-xs text-green-300/90 whitespace-pre-wrap">
            {JSON.stringify(structures, null, 2)}
          </div>
        </div>
        <div className="bg-[#101014] border border-border rounded-lg p-4">
          <div className="text-[11px] font-mono text-muted-foreground mb-2">
            CLEAN JSON {loading && <span className="text-cyan-400 animate-pulse">· parsing…</span>}
          </div>
          <div className="font-mono text-sm max-h-[340px] overflow-y-auto pr-1">
            {data != null && <JsonNode data={data} />}
          </div>
        </div>
      </div>
    </div>
  );
}