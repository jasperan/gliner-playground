"use client";

import { useEffect } from "react";
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

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border px-4 md:px-6 py-3 flex items-center gap-4">
        <a href="#" className="flex items-center gap-2 font-bold text-foreground no-underline shrink-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-extrabold text-white text-sm">
            G
          </div>
          <span className="hidden md:inline text-sm font-semibold">GLiNER Playground</span>
        </a>
        <div className="flex gap-3 md:gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide ml-auto">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-xs text-muted-foreground hover:text-foreground no-underline transition-colors shrink-0">
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden py-20 px-6 hero-gradient">
        <div className="hero-glow" />
        <div className="max-w-3xl mx-auto relative">
          <div className="text-xs font-mono text-purple-300 mb-4 animate-fade-in">
            INFORMATION EXTRACTION · LEARN BY PLAYING
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Give a small language model any label, and it will{" "}
            <span className="text-cyan-400">find it anywhere</span>.
          </h1>
          <p className="text-zinc-400 mt-5 leading-7 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <span className="text-orange-400 font-semibold">GLiNER</span> is a family of compact, bidirectional transformers that do{" "}
            <span className="text-cyan-400 font-semibold">zero-shot named entity recognition</span> — you define the entity types at inference time, in any language, with no fine-tuning.{" "}
            <span className="text-purple-400 font-semibold">GLiNER2</span> extends that to text classification, structured JSON extraction and relation extraction in a{" "}
            <span className="text-green-400 font-semibold">single efficient model</span> that runs on a laptop CPU. This page is a playground — scroll, type, drag sliders, and watch it work.
          </p>
          <div className="flex flex-wrap gap-3 mt-8 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <a href="#zero-shot" className="btn-mono active">▶ Start playing</a>
            <span className="text-xs text-muted-foreground self-center font-mono">
              open-source · Apache-2.0 · <a href="https://github.com/fastino-ai/GLiNER2" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-cyan-300">GLiNER2</a> · <a href="https://github.com/urchade/GLiNER" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-cyan-300">GLiNER</a>
            </span>
          </div>
        </div>
      </div>

      {/* TOC */}
      <section className="max-w-5xl mx-auto px-6 mt-10">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">What you&apos;ll explore</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            {NAV.map((item, i) => (
              <a key={item.href} href={item.href} className="no-underline text-muted-foreground hover:text-cyan-300 flex items-center gap-2 group">
                <span className="font-mono text-[11px] text-purple-400/70">{String(i + 1).padStart(2, "0")}</span>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 1 · Zero-shot NER */}
      <section id="zero-shot" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-orange-400">01</span> · Named entity recognition on <span className="text-orange-400">your terms</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          Classic NER models are locked to a fixed label set — <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">person</span>,{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">org</span>,{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">location</span> — trained once and frozen. GLiNER flips that: the{" "}
          <span className="text-orange-400">entity types you want</span> are fed to the model alongside the text at inference time. Want to find{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">drugs</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">order numbers</span> or{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">pizza toppings</span> in your data? Just type the label in.
        </p>

        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <ZeroShotNERWidget />
        </div>

        <p className="text-zinc-400 leading-7">
          Behind each highlighted span is a <span className="text-cyan-400">confidence score</span>: the model encodes the text and your labels into the same vector space, scores every candidate span against every label, and keeps the pairs above your threshold. The label list is just an{" "}
          <span className="text-green-400">input</span> — trivially changeable per document, per request, per user.
        </p>
      </section>

      {/* 2 · How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-purple-400">02</span> · Anatomy of a <span className="text-cyan-400">span scorer</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-zinc-400 leading-7">
            <p>
              GLiNER is built on a <span className="text-orange-400">bidirectional transformer encoder</span> (DeBERTa-style) instead of a generative decoder. It sees the whole sentence at once and learns pairwise representations.
            </p>
            <p className="mt-3">
              For every candidate <span className="text-cyan-400">span</span> of tokens, it builds a representation; for every <span className="text-green-400">label</span> you name, it embeds the label text (e.g. &quot;person&quot;, &quot;email address&quot;) too. Then it scores{" "}
              <span className="font-mono text-xs">⟨span, label⟩</span> pairs directly — a lightweight classifier, not an auto-regressive generation loop. That&apos;s why 200M parameters beat multi-billion LLMs at this task, in milliseconds, on CPU.
            </p>
          </div>
          <div className="widget-container bg-card border border-border rounded-xl p-6 overflow-hidden">
            <HowGLiNERWorksWidget />
          </div>
        </div>
      </section>

      {/* 3 · Threshold */}
      <section id="threshold" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-purple-400">03</span> · Confidence thresholds = your <span className="text-purple-400">precision dial</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          Every extraction is a probability. Raise the bar and you keep only the spans the model is sure about (<span className="text-purple-400">precision</span>); lower it and you catch more of everything (<span className="text-purple-400">recall</span>). Drag the slider and watch the same text change its verdict.
        </p>
        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <ThresholdExplorerWidget />
        </div>
      </section>

      {/* 4 · Multilingual */}
      <section id="multilingual" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-pink-400">04</span> · One model, <span className="text-pink-400">six languages</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          Traditional pipelines need a separate NER model per language — plus expensive translation steps. The multilingual GLiNER checkpoints are pretrained on{" "}
          <span className="text-pink-400">French, Spanish, German, Italian, Portuguese and English</span> simultaneously. Write the labels in the local language and the same weights do the work.
        </p>
        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <MultilingualWidget />
        </div>
      </section>

      {/* 5 · Classification */}
      <section id="classification" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-green-400">05</span> · Beyond spans: <span className="text-green-400">text classification</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          GLiNER2 turns the same span-scoring trick into a zero-shot classifier: you provide the candidate labels for a task (sentiment? topic? intent?) and the model picks the best match — no label corpus, no fine-tune, no prompt-tuning.
        </p>
        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <ClassificationWidget />
        </div>
      </section>

      {/* 6 · Structured */}
      <section id="structured" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-cyan-400">06</span> · Messy text → <span className="text-cyan-400">structured JSON</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          Human text doesn&apos;t arrive as key-value pairs. GLiNER2&apos;s schema-driven interface lets you declare a target shape —{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">field::dtype::description</span> — and the model fills it from raw sentences. This is the extraction layer that feeds RAG indexes, analytics, and CRM imports.
        </p>
        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <StructuredExtractionWidget />
        </div>
      </section>

      {/* 7 · Relations */}
      <section id="relations" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-amber-400">07</span> · Who relates to <span className="text-amber-400">whom</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          Entities alone are flat facts. GLiNER2 also extracts typed relations — works_for, lives_in — building a mini knowledge graph in one pass. Perfect for agentic RAG: now the agent can answer &quot;who works at Fastino?&quot; without another model call.
        </p>
        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <RelationGraphWidget />
        </div>
      </section>

      {/* 8 · Zoo */}
      <section id="zoo" className="max-w-5xl mx-auto px-6 mt-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="text-zinc-300">08</span> · Pick your <span className="text-zinc-300">model</span>
        </h2>
        <p className="text-zinc-400 leading-7 mt-4">
          The GLiNER family spans ~64M to ~205M parameters. Small runs anywhere; the unified GLiNER2 models trade a little latency for four tasks in one checkpoint. All of them run on CPU — GLiNER2&apos;s 205M model has been demonstrated comfortably on a laptop.
        </p>
        <div className="widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden">
          <ModelZooWidget />
        </div>
      </section>

      {/* Conclusion */}
      <section className="max-w-5xl mx-auto px-6 mt-20 reveal">
        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-2xl font-bold">
            What you just played with <span className="text-cyan-400">is production ready</span>
          </h2>
          <p className="text-zinc-400 leading-7 mt-4">
            Everything on this page is backed by real inference from a FastAPI service running GLiNER/GLiNER2 on a GPU — the same code paths ship in this repository&apos;s backend, CLI examples, and test suite. The ideas you explored map directly to real deployments:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-sm">
            <div className="bg-muted/40 border border-border rounded-lg p-4">
              <div className="text-orange-400 font-mono text-xs mb-1">PII redaction</div>
              <p className="text-zinc-400 text-xs leading-5">Strip emails, phones, order numbers from support tickets before they hit third-party tools.</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-4">
              <div className="text-cyan-400 font-mono text-xs mb-1">Document parsing</div>
              <p className="text-zinc-400 text-xs leading-5">Turn contracts, invoices, and emails into structured JSON for RAG or analytics.</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-4">
              <div className="text-purple-400 font-mono text-xs mb-1">Agentic extraction</div>
              <p className="text-zinc-400 text-xs leading-5">Give an LLM agent a fast, cheap extractor that classifies, parses, and links entities.</p>
            </div>
          </div>
          <p className="text-zinc-500 text-sm mt-6 leading-6">
            Built with <a href="https://github.com/urchade/GLiNER" target="_blank" rel="noreferrer" className="text-cyan-400 underline underline-offset-2">GLiNER</a> and <a href="https://github.com/fastino-ai/GLiNER2" target="_blank" rel="noreferrer" className="text-cyan-400 underline underline-offset-2">GLiNER2</a> (Fastino Labs). Models on Hugging Face:{" "}
            <span className="font-mono text-xs">fastino/gliner2-base-v1</span>, <span className="font-mono text-xs">fastino/gliner2-multi-v1</span>, <span className="font-mono text-xs">urchade/gliner_small-v2.1</span>.
          </p>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-12 text-sm text-muted-foreground">
        <p>
          GLiNER Playground — an interactive tour of zero-shot information extraction. Run locally:{" "}
          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">cd backend && uv run python __run__.py</code> then{" "}
          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">cd site && npm run dev</code>.
        </p>
      </footer>
    </main>
  );
}