// Curated demo results mirroring the backend API shapes. Used when the
// FastAPI backend is offline so the static site remains fully interactive.

export const DEMO_ENTITIES = (text: string, labels: string[]) => {
  const has = (t: string) => text.toLowerCase().includes(t.toLowerCase());
  const entities: { label: string; text: string; confidence: number; start: number; end: number }[] = [];

  const find = (needle: string): number => text.toLowerCase().indexOf(needle.toLowerCase());
  const add = (label: string, needle: string, confidence: number) => {
    const s = find(needle);
    if (s >= 0) entities.push({ label, text: text.slice(s, s + needle.length), confidence, start: s, end: s + needle.length });
  };

  const want = (l: string) => labels.some((x) => x.toLowerCase() === l.toLowerCase());

  if (want("person")) {
    if (has("tim cook")) add("person", "Tim Cook", 0.99);
    if (has("elon musk")) add("person", "Elon Musk", 0.97);
    if (has("sarah")) add("person", "Sarah", 0.96);
    if (has("jk rowling") || has("j.k. rowling")) add("person", text.match(/J\.?K\. Rowling/i)?.[0] ?? "J.K. Rowling", 0.94);
    if (has("john")) add("person", "John", 0.92);
    if (has("emily")) add("person", "Emily Carter", 0.9);
  }
  if (want("company") || want("organization") || want("entreprise") || want("empresa") || want("azienda")) {
    if (has("apple")) add("company", "Apple", 0.99);
    if (has("spacex")) add("company", "SpaceX", 0.96);
    if (has("tesla")) add("company", "Tesla", 0.95);
    if (has("acme")) add("company", "Acme Corp", 0.94);
    if (has("bloomsbury")) add("company", "Bloomsbury", 0.93);
    if (has("fastino")) add("company", "Fastino Labs", 0.97);
  }
  if (want("product")) {
    if (has("iphone 15")) add("product", "iPhone 15", 0.98);
    if (has("pixel 9")) add("product", "Pixel 9", 0.93);
  }
  if (want("location") || want("city") || want("lieu") || want("ubicaci")) {
    if (has("cupertino")) add("location", "Cupertino", 0.97);
    if (has("california")) add("location", "California", 0.9);
    if (has("london")) add("location", "London", 0.95);
    if (has("san francisco")) add("location", "San Francisco", 0.93);
    if (has("paris")) add("location", "Paris", 0.94);
  }
  if (want("book")) {
    if (has("harry potter")) add("book", "Harry Potter", 0.92);
  }
  if (want("email") || want("email_address")) {
    const m = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (m) {
      const s = m.index ?? 0;
      entities.push({ label: "email_address", text: m[0], confidence: 1.0, start: s, end: s + m[0].length });
    }
  }
  if (want("phone") || want("phone_number")) {
    const m = text.match(/(\+?[\d][\d\s.-]{5,}\d)/);
    if (m) {
      const s = m.index ?? 0;
      entities.push({ label: "phone_number", text: m[0], confidence: 0.98, start: s, end: s + m[0].length });
    }
  }
  // dedupe by (label, text)
  const seen = new Set<string>();
  const unique = entities.filter((e) => {
    const k = `${e.label}|${e.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  void has;
  return { model: "fallback-demo-data", family: "gliner2" as const, latency_ms: 42, entities: unique };
};

export const DEMO_CLASSIFY = (text: string) => {
  const t = text.toLowerCase();
  const sentiment = /terrible|bad|awful|hate|disappoint/.test(t)
    ? ["negative", 0.94]
    : /amazing|great|love|fantastic|excellent|good/.test(t)
      ? ["positive", 0.97]
      : ["neutral", 0.71];
  const isTech = /laptop|iphone|phone|computer|gpu|code|software|cloud|model/.test(t);
  const isFood = /pizza|coffee|restaurant|meal|taste|food/.test(t);
  const topic = isTech ? ["tech", 0.99] : isFood ? ["food", 0.96] : ["tech", 0.6];
  return {
    model: "fallback-demo-data",
    latency_ms: 36,
    classifications: [
      { task: "sentiment", label: sentiment[0], confidence: sentiment[1] },
      { task: "topic", label: topic[0], confidence: topic[1] },
    ],
  };
};

export const DEMO_STRUCTURED = (text: string) => {
  const t = text.toLowerCase();
  const product: Record<string, { text: string; confidence: number }> = {};
  if (t.includes("iphone")) product["name"] = { text: "iPhone 15 Pro Max", confidence: 1.0 };
  if (t.includes("macbook")) product["name"] = { text: "MacBook Air M3", confidence: 1.0 };
  const storage = text.match(/(\d+(?:tb|gb))/i);
  if (storage) product["storage"] = { text: storage[0], confidence: 0.98 };
  const price = text.match(/\$\s?\d[\d,]*/);
  if (price) product["price"] = { text: price[0].replace(/\s/g, ""), confidence: 0.99 };
  const screen = text.match(/(\d+(?:\.\d+)?-?inch)/i);
  if (screen) product["screen"] = { text: screen[0], confidence: 0.9 };
  if (!product["name"]) product["name"] = { text: text.split(" ").slice(0, 4).join(" "), confidence: 0.5 };

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phone = text.match(/(\+?[\d][\d\s.-]{5,}\d)/);
  const contact: Record<string, { text: string; confidence: number }> = {};
  if (email) contact["email"] = { text: email[0], confidence: 1.0 };
  if (phone) contact["phone"] = { text: phone[0], confidence: 0.97 };

  return {
    model: "fallback-demo-data",
    latency_ms: 38,
    data: {
      ...(Object.keys(product).length ? { product: [product] } : {}),
      ...(Object.keys(contact).length ? { contact: [contact] } : {}),
    },
  };
};

export const DEMO_RELATIONS = (text: string) => {
  const t = text.toLowerCase();
  const relations = [];
  let johnS = t.indexOf("john");
  let appleS = t.indexOf("apple");
  let sfS = t.indexOf("san francisco");
  if (johnS >= 0 && appleS >= 0) {
    relations.push({
      relation: "works_for",
      head: "John",
      head_confidence: 1.0,
      tail: "Apple Inc.",
      tail_confidence: 1.0,
    });
  }
  if (johnS >= 0 && sfS >= 0) {
    relations.push({
      relation: "lives_in",
      head: "John",
      head_confidence: 0.99,
      tail: "San Francisco",
      tail_confidence: 1.0,
    });
  }
  const emilyS = t.indexOf("emily");
  const fastinoS = t.indexOf("fastino");
  if (emilyS >= 0 && fastinoS >= 0) {
    relations.push({
      relation: "works_for",
      head: "Emily Carter",
      head_confidence: 0.98,
      tail: "Fastino Labs",
      tail_confidence: 0.99,
    });
  }
  void johnS; void appleS; void sfS; void emilyS; void fastinoS;
  return { model: "fallback-demo-data", latency_ms: 31, relations };
};

export const DEMO_COMPARE = () => ({
  results: [
    {
      model: "urchade/gliner_small-v2.1",
      family: "gliner",
      latency_ms: 128,
      entities: [
        { label: "person", text: "Tim Cook", confidence: 0.94, start: 0, end: 8 },
        { label: "company", text: "Apple", confidence: 0.99, start: 12, end: 17 },
      ],
    },
    {
      model: "gliner-community/gliner_medium-v2.5",
      family: "gliner",
      latency_ms: 187,
      entities: [
        { label: "person", text: "Tim Cook", confidence: 1.0, start: 0, end: 8 },
        { label: "company", text: "Apple", confidence: 1.0, start: 12, end: 17 },
      ],
    },
    {
      model: "uchade/gliner_multi-v2.1",
      family: "gliner",
      latency_ms: 201,
      entities: [
        { label: "person", text: "Tim Cook", confidence: 0.98, start: 0, end: 8 },
        { label: "company", text: "Apple", confidence: 0.97, start: 12, end: 17 },
      ],
    },
    {
      model: "fastino/gliner2-base-v1",
      family: "gliner2",
      latency_ms: 76,
      entities: [
        { label: "person", text: "Tim Cook", confidence: 1.0, start: 0, end: 8 },
        { label: "company", text: "Apple", confidence: 1.0, start: 12, end: 17 },
      ],
    },
  ],
});

export const DEMO_BENCHMARK = () => ({
  results: [
    { model: "urchade/gliner_small-v2.1", avg_ms: 118, min_ms: 112, max_ms: 126 },
    { model: "gliner-community/gliner_medium-v2.5", avg_ms: 176, min_ms: 169, max_ms: 188 },
    { model: "urchade/gliner_multi-v2.1", avg_ms: 192, min_ms: 180, max_ms: 205 },
    { model: "fastino/gliner2-base-v1", avg_ms: 71, min_ms: 65, max_ms: 79 },
  ],
});