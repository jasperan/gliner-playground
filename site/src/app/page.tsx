import {
  ZeroShotNERWidget,
  MultilingualWidget,
  ThresholdExplorerWidget,
  ClassificationWidget,
  StructuredExtractionWidget,
  RelationGraphWidget,
  ModelZooWidget,
  HowGLiNERWorksWidget,
} from "@/components/widgets";

const NAV = [
  { href: "#zero-shot", label: "Zero-shot NER" },
  { href: "#how", label: "How it works" },
  { href: "#multilingual", label: "Multilingual" },
  { href: "#threshold", label: "Thresholds" },
  { href: "#classification", label: "Classification" },
  { href: "#structured", label: "Structured data" },
  { href: "#relations", label: "Relations" },
  { href: "#zoo", label: "Model zoo" },
];

/* The hero readout: the same span scores section 02 walks through, printed
   as a static instrument so the mechanism is visible before the first widget. */
const HERO_SPANS = [
  { text: "Apple", label: "company", conf: 0.99, ink: "ink-a" },
  { text: "Tim Cook", label: "person", conf: 0.96, ink: "ink-b" },
  { text: "iPhone 15", label: "product", conf: 0.93, ink: "ink-c" },
  { text: "Cupertino", label: "place", conf: 0.88, ink: "ink-d" },
];

export default function Home() {
  return (
    <main>
      <nav className="nav">
        <div className="page nav-inner">
          <a href="#top" className="wordmark">
            GLiNER <span>Playground</span>
          </a>
          <div className="nav-links scrollbar-hide">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="nav-link">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <header id="top" className="page hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">A working tour of GLiNER and GLiNER2</p>
            <h1 className="display">Give a small language model any label, and it will find it anywhere.</h1>
            <p className="lede">
              GLiNER is a family of compact transformers that do zero-shot named entity recognition: you name the entity
              types at inference time, in any language, with no fine-tuning. GLiNER2 adds text classification, structured
              JSON extraction and relation extraction to the same checkpoint, and the whole family runs on a laptop CPU.
            </p>
            <div className="actions">
              <a href="#zero-shot" className="btn btn-primary">
                Start with the playground
              </a>
              <div className="meta-links">
                <span>open source · Apache-2.0</span>
                <span aria-hidden>·</span>
                <a href="https://github.com/fastino-ai/GLiNER2" target="_blank" rel="noreferrer">
                  GLiNER2
                </a>
                <span aria-hidden>·</span>
                <a href="https://github.com/urchade/GLiNER" target="_blank" rel="noreferrer">
                  GLiNER
                </a>
              </div>
            </div>
          </div>

          <div className="readout">
            <div className="readout-head">
              <span className="widget-name">span readout</span>
              <span className="instrument" style={{ marginLeft: "auto" }}>
                4 of 4 above 0.50
              </span>
            </div>
            <div className="readout-body">
              <p className="readout-text">
                <mark className="mark ink-a">Apple</mark> CEO <mark className="mark ink-b">Tim Cook</mark> announced the{" "}
                <mark className="mark ink-c">iPhone 15</mark> in <mark className="mark ink-d">Cupertino</mark>.
              </p>
              <div className="ladder">
                {HERO_SPANS.map((s) => (
                  <div className="ladder-row" key={s.text}>
                    <span className="ladder-name">{s.text}</span>
                    <span className="ladder-tag">{s.label}</span>
                    <div className="meter meter-accent">
                      <span style={{ width: `${s.conf * 100}%` }} />
                    </div>
                    <span className="ladder-score">{s.conf.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="readout-foot">
              <span className="instrument">fastino/gliner2-base-v1 · 205M params · CPU</span>
            </div>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="toc">
          <div className="toc-head">Contents</div>
          <div className="toc-grid">
            {NAV.map((item, i) => (
              <a key={item.href} href={item.href} className="toc-link">
                <span className="toc-num">{String(i + 1).padStart(2, "0")}</span>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 01 · Zero-shot NER */}
      <section id="zero-shot" className="page section">
        <div className="rail">
          <span className="rail-num">01</span>
          <span className="rail-label">Zero-shot NER</span>
        </div>
        <div className="section-main">
          <div className="split split-first">
            <div>
              <h2 className="h2">Named entity recognition on your terms</h2>
              <p className="prose">
                Classic NER models are locked to a fixed label set — <span className="code">person</span>,{" "}
                <span className="code">org</span>, <span className="code">location</span> — trained once and frozen. GLiNER
                flips that: the entity types you want are fed to the model alongside the text, at inference time.
              </p>
              <p className="prose">
                Want to find <span className="code">drugs</span>, <span className="code">order numbers</span> or{" "}
                <span className="code">pizza toppings</span> in your data? Type the label in and the same weights look for
                it.
              </p>
              <p className="prose">
                Behind each highlighted span is a confidence score. The model encodes the text and your labels into the
                same vector space, scores every candidate span against every label, and keeps the pairs above your
                threshold. The label list is just an input — changeable per document, per request, per user.
              </p>
            </div>
            <ZeroShotNERWidget />
          </div>
        </div>
      </section>

      {/* 02 · How it works */}
      <section id="how" className="page section">
        <div className="rail">
          <span className="rail-num">02</span>
          <span className="rail-label">How it works</span>
        </div>
        <div className="section-main">
          <div className="split split-2 split-reverse">
            <div>
              <h2 className="h2">Anatomy of a span scorer</h2>
              <p className="prose">
                GLiNER is built on a bidirectional transformer encoder (DeBERTa-style) instead of a generative decoder. It
                sees the whole sentence at once and learns pairwise representations.
              </p>
              <p className="prose">
                For every candidate span of tokens it builds a representation; for every label you name it embeds the label
                text (e.g. &quot;person&quot;, &quot;email address&quot;) too. Then it scores <span className="code">⟨span, label⟩</span>{" "}
                pairs directly — a lightweight classifier, not an auto-regressive generation loop. That is why 200M
                parameters beat multi-billion LLMs at this task, in milliseconds, on CPU.
              </p>
            </div>
            <HowGLiNERWorksWidget />
          </div>
        </div>
      </section>

      {/* 03 · Threshold */}
      <section id="threshold" className="page section">
        <div className="rail">
          <span className="rail-num">03</span>
          <span className="rail-label">Thresholds</span>
        </div>
        <div className="section-main">
          <h2 className="h2">Confidence thresholds are your precision dial</h2>
          <p className="prose">
            Every extraction is a probability. Raise the bar and you keep only the spans the model is sure about
            (precision); lower it and you catch more of everything (recall). Drag the slider and watch the same text change
            its verdict.
          </p>
          <ThresholdExplorerWidget />
        </div>
      </section>

      {/* 04 · Multilingual */}
      <section id="multilingual" className="page section">
        <div className="rail">
          <span className="rail-num">04</span>
          <span className="rail-label">Multilingual</span>
        </div>
        <div className="section-main">
          <h2 className="h2">One model, six languages</h2>
          <p className="prose">
            Traditional pipelines need a separate NER model per language, plus translation steps. The multilingual GLiNER
            checkpoints are pretrained on French, Spanish, German, Italian, Portuguese and English simultaneously. Write
            the labels in the local language and the same weights do the work.
          </p>
          <MultilingualWidget />
        </div>
      </section>

      {/* 05 · Classification */}
      <section id="classification" className="page section">
        <div className="rail">
          <span className="rail-num">05</span>
          <span className="rail-label">Classification</span>
        </div>
        <div className="section-main">
          <h2 className="h2">Beyond spans: text classification</h2>
          <p className="prose">
            GLiNER2 turns the same span-scoring trick into a zero-shot classifier: you provide the candidate labels for a
            task (sentiment? topic? intent?) and the model picks the best match — no label corpus, no fine-tune, no
            prompt-tuning.
          </p>
          <ClassificationWidget />
        </div>
      </section>

      {/* 06 · Structured */}
      <section id="structured" className="page section">
        <div className="rail">
          <span className="rail-num">06</span>
          <span className="rail-label">Structured data</span>
        </div>
        <div className="section-main">
          <h2 className="h2">Messy text becomes structured JSON</h2>
          <p className="prose">
            Human text doesn&apos;t arrive as key-value pairs. GLiNER2&apos;s schema-driven interface lets you declare a
            target shape — <span className="code">field::dtype::description</span> — and the model fills it from raw
            sentences. This is the extraction layer that feeds RAG indexes, analytics, and CRM imports.
          </p>
          <StructuredExtractionWidget />
        </div>
      </section>

      {/* 07 · Relations */}
      <section id="relations" className="page section">
        <div className="rail">
          <span className="rail-num">07</span>
          <span className="rail-label">Relations</span>
        </div>
        <div className="section-main">
          <h2 className="h2">Who relates to whom</h2>
          <p className="prose">
            Entities alone are flat facts. GLiNER2 also extracts typed relations — works_for, lives_in — building a mini
            knowledge graph in one pass. That is what agentic RAG needs: the agent can answer &quot;who works at
            Fastino?&quot; without another model call.
          </p>
          <RelationGraphWidget />
        </div>
      </section>

      {/* 08 · Zoo */}
      <section id="zoo" className="page section">
        <div className="rail">
          <span className="rail-num">08</span>
          <span className="rail-label">Model zoo</span>
        </div>
        <div className="section-main">
          <h2 className="h2">Pick your model</h2>
          <p className="prose">
            The GLiNER family spans ~64M to ~205M parameters. Small runs anywhere; the unified GLiNER2 models trade a
            little latency for four tasks in one checkpoint. All of them run on CPU — GLiNER2&apos;s 205M model has been
            demonstrated comfortably on a laptop.
          </p>
          <ModelZooWidget />
        </div>
      </section>

      {/* Conclusion */}
      <section className="page">
        <div className="cta">
          <h2 className="h2">What you just played with is production ready</h2>
          <p className="prose">
            Everything on this page is backed by real inference from a FastAPI service running GLiNER/GLiNER2 on a GPU —
            the same code paths ship in this repository&apos;s backend, CLI examples, and test suite. The ideas you
            explored map directly to real deployments:
          </p>
          <div className="cta-grid">
            <div className="cta-card">
              <h3>PII redaction</h3>
              <p>Strip emails, phones, order numbers from support tickets before they hit third-party tools.</p>
            </div>
            <div className="cta-card">
              <h3>Document parsing</h3>
              <p>Turn contracts, invoices, and emails into structured JSON for RAG or analytics.</p>
            </div>
            <div className="cta-card">
              <h3>Agentic extraction</h3>
              <p>Give an LLM agent a fast, cheap extractor that classifies, parses, and links entities.</p>
            </div>
          </div>
          <p className="note" style={{ marginTop: 24 }}>
            Built with{" "}
            <a href="https://github.com/urchade/GLiNER" target="_blank" rel="noreferrer">
              GLiNER
            </a>{" "}
            and{" "}
            <a href="https://github.com/fastino-ai/GLiNER2" target="_blank" rel="noreferrer">
              GLiNER2
            </a>{" "}
            (Fastino Labs). Models on Hugging Face: <span className="code">fastino/gliner2-base-v1</span>,{" "}
            <span className="code">fastino/gliner2-multi-v1</span>, <span className="code">urchade/gliner_small-v2.1</span>.
          </p>
        </div>
      </section>

      <footer className="page footer">
        <p>
          GLiNER Playground — an interactive tour of zero-shot information extraction. Run locally:{" "}
          <code>cd backend && uv run python __run__.py</code> then <code>cd site && npm run dev</code>.
        </p>
      </footer>
    </main>
  );
}
