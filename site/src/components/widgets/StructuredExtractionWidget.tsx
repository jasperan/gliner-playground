"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkBackend, fetchStructured } from "@/lib/api";
import { DEMO_STRUCTURED } from "@/lib/demo";
import { Foot, Status } from "./parts";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 300);
    return () => clearTimeout(debounceRef.current);
  }, [run]);

  const applyPreset = (i: number) => {
    setPreset(i);
    setText(PRESETS[i].text);
    setStructures(PRESETS[i].structures);
  };

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">schema-extraction</span>
        <span className="instrument" style={{ marginLeft: "auto" }}>
          {Object.keys(structures).length} object
          {Object.keys(structures).length === 1 ? "" : "s"} in the schema
        </span>
        <Status live={live} />
      </div>

      <div className="widget-body">
        <div className="field-row">
          {PRESETS.map((p, i) => (
            <button key={p.name} className="chip" onClick={() => applyPreset(i)} aria-pressed={i === preset}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="split split-2" style={{ marginTop: 0 }}>
          <div className="stack">
            <div className="label-row">
              <span className="label">Raw input</span>
              <span className="instrument">human-flavoured text</span>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="field" />
            <div className="label-row" style={{ marginTop: 4 }}>
              <span className="label">Schema</span>
              <span className="instrument">field::dtype::description</span>
            </div>
            <div className="well" style={{ padding: 10 }}>
              <pre className="json" style={{ margin: 0 }}>
                {JSON.stringify(structures, null, 2)}
              </pre>
            </div>
          </div>

          <div className="well">
            <div className="label-row">
              <span className="label">Clean JSON</span>
              {loading && <span className="instrument">parsing</span>}
            </div>
            <div className="json-scroll" style={{ marginTop: 10 }}>
              {data != null && <JsonNode data={data} />}
            </div>
          </div>
        </div>
      </div>

      <Foot items={["fastino/gliner2-base-v1", "205M params", latency != null ? `${latency.toFixed(0)} ms` : null]} />
    </div>
  );
}
