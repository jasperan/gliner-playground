"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchEntities, checkBackend } from "@/lib/api";
import { Foot, Status } from "./parts";

type Lang = {
  code: string;
  name: string;
  text: string;
  labels: string[];
};

const LANGS: Lang[] = [
  {
    code: "en",
    name: "English",
    text: "Apple CEO Tim Cook announced the iPhone 15 in Cupertino.",
    labels: ["company", "person", "product", "location"],
  },
  {
    code: "fr",
    name: "Français",
    text: "Le PDG d'Apple, Tim Cook, a annoncé l'iPhone 15 à Cupertino.",
    labels: ["entreprise", "personne", "produit", "lieu"],
  },
  {
    code: "es",
    name: "Español",
    text: "El CEO de Apple, Tim Cook, anunció el iPhone 15 en Cupertino.",
    labels: ["empresa", "persona", "producto", "ubicación"],
  },
  {
    code: "de",
    name: "Deutsch",
    text: "Apple-CEO Tim Cook kündigte das iPhone 15 in Cupertino an.",
    labels: ["Unternehmen", "Person", "Produkt", "Ort"],
  },
  {
    code: "it",
    name: "Italiano",
    text: "Il CEO di Apple, Tim Cook, ha annunciato l'iPhone 15 a Cupertino.",
    labels: ["azienda", "persona", "prodotto", "luogo"],
  },
  {
    code: "pt",
    name: "Português",
    text: "O CEO da Apple, Tim Cook, anunciou o iPhone 15 em Cupertino.",
    labels: ["empresa", "pessoa", "produto", "local"],
  },
];

const DEMO_KNOWN: Record<string, Record<string, string[]>> = {
  en: { company: ["Apple"], person: ["Tim Cook"], product: ["iPhone 15"], location: ["Cupertino"] },
  fr: { entreprise: ["Apple"], personne: ["Tim Cook"], produit: ["iPhone 15"], lieu: ["Cupertino"] },
  es: { empresa: ["Apple"], persona: ["Tim Cook"], producto: ["iPhone 15"], ubicación: ["Cupertino"] },
  de: { Unternehmen: ["Apple-CEO"], Person: ["Tim Cook"], Produkt: ["iPhone 15"], Ort: ["Cupertino"] },
  it: { azienda: ["Apple"], persona: ["Tim Cook"], prodotto: ["iPhone 15"], luogo: ["Cupertino"] },
  pt: { empresa: ["Apple"], pessoa: ["Tim Cook"], produto: ["iPhone 15"], local: ["Cupertino"] },
};

export default function MultilingualWidget() {
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Record<string, { label: string; text: string; confidence: number }[]>>({});
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);

  const lang = LANGS[active];

  const runAll = useCallback(async () => {
    setLoading(true);
    const out: Record<string, { label: string; text: string; confidence: number }[]> = {};
    let isLive = false;
    try {
      if (await checkBackend()) {
        isLive = true;
        await Promise.all(
          LANGS.map(async (l) => {
            const res = await fetchEntities(l.text, l.labels, "fastino/gliner2-multi-v1", 0.5);
            out[l.code] = res.entities.map((e) => ({ label: e.label, text: e.text, confidence: e.confidence }));
          })
        );
      }
    } catch {
      isLive = false;
    }
    if (!isLive) {
      for (const l of LANGS) {
        const known = DEMO_KNOWN[l.code] ?? {};
        out[l.code] = Object.entries(known).flatMap(([label, texts], i) =>
          texts.map((text) => ({ label, text, confidence: 0.97 - i * 0.02 }))
        );
      }
    }
    setResults(out);
    setLive(isLive);
    setLoading(false);
  }, []);

  useEffect(() => {
    runAll();
  }, [runAll]);

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-name">multilingual</span>
        <span className="instrument" style={{ marginLeft: "auto" }}>
          {LANGS.length} languages · one checkpoint
        </span>
        <Status live={live} />
      </div>

      <div className="widget-body">
        <div className="field-row">
          {LANGS.map((l, i) => (
            <button key={l.code} className="chip" onClick={() => setActive(i)} aria-pressed={i === active}>
              {l.name}
            </button>
          ))}
        </div>

        <div className="split split-2" style={{ marginTop: 0 }}>
          <div className="well">
            <div className="label-row">
              <span className="label">Input — labels written in {lang.name}</span>
              <span className="instrument">{lang.code}</span>
            </div>
            <p className="passage" style={{ marginTop: 10, maxHeight: "none" }}>
              {lang.text}
            </p>
            <div className="field-row" style={{ marginTop: 12 }}>
              {lang.labels.map((label) => (
                <span key={label} className="tag">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="well">
            <div className="label-row">
              <span className="label">Extracted</span>
              {loading && results[lang.code] === undefined && <span className="instrument">running</span>}
            </div>
            <div className="ladder" style={{ marginTop: 10 }}>
              {(results[lang.code] ?? []).map((e, i) => (
                <div key={i} className="ladder-row row-fade" style={{ gridTemplateColumns: "88px minmax(0,1fr) 36px" }}>
                  <span className="ladder-tag">{e.label}</span>
                  <span className="ladder-name">{e.text}</span>
                  <span className="ladder-score">{(e.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="note">
          Same sentence, six languages, one stored model — the entity labels were written in each language, at inference
          time, with zero training data.
        </p>
      </div>

      <Foot items={["fastino/gliner2-multi-v1", "205M params", `${LANGS.length} languages`]} />
    </div>
  );
}
