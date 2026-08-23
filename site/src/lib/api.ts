// API client for the GLiNER Playground backend.
// Every function returns a result; when the backend is unreachable it falls
// back to curated demo data so the static site stays fully interactive.

export const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

export type Entity = {
  label: string;
  text: string;
  confidence: number;
  start?: number | null;
  end?: number | null;
};

export type EntityResponse = {
  model: string;
  family: "gliner" | "gliner2";
  latency_ms: number;
  entities: Entity[];
};

export type Classification = {
  task: string;
  label: string;
  confidence: number;
};

export type ClassificationResponse = {
  model: string;
  latency_ms: number;
  classifications: Classification[];
};

export type ModelInfo = {
  id: string;
  family: string;
  name: string;
  params: string;
  languages: string[];
  tasks: string[];
  note: string;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchEntities(
  text: string,
  labels: string[],
  model = "fastino/gliner2-base-v1",
  threshold = 0.5
): Promise<EntityResponse> {
  return post<EntityResponse>("/api/entities", { text, labels, model, threshold });
}

export async function fetchClassification(
  text: string,
  tasks: Record<string, string[]>,
  model = "fastino/gliner2-base-v1"
): Promise<ClassificationResponse> {
  return post<ClassificationResponse>("/api/classify", { text, tasks, model });
}

export async function fetchStructured(
  text: string,
  structures: Record<string, string[]>,
  model = "fastino/gliner2-base-v1"
): Promise<{ model: string; latency_ms: number; data: unknown }> {
  return post("/api/structured", { text, structures, model });
}

export async function fetchRelations(
  text: string,
  relationTypes: string[],
  model = "fastino/gliner2-base-v1"
): Promise<{
  model: string;
  latency_ms: number;
  relations: {
    relation: string;
    head: string;
    head_confidence: number;
    tail: string;
    tail_confidence: number;
  }[];
}> {
  return post("/api/relations", { text, relation_types: relationTypes, model });
}

export async function fetchCompare(
  text: string,
  labels: string[],
  models: string[]
): Promise<{
  results: { model: string; family: string; latency_ms: number; entities: Entity[] }[];
}> {
  return post("/api/compare", { text, labels, models });
}

export async function fetchBenchmark(
  text: string,
  labels: string[],
  models: string[],
  iterations = 3
): Promise<{ results: { model: string; avg_ms: number; min_ms: number; max_ms: number }[] }> {
  return post("/api/benchmark", { text, labels, models, iterations });
}

export const MODEL_IDS = {
  small: "urchade/gliner_small-v2.1",
  medium: "gliner-community/gliner_medium-v2.5",
  multi: "urchade/gliner_multi-v2.1",
  g2base: "fastino/gliner2-base-v1",
  g2multi: "fastino/gliner2-multi-v1",
} as const;