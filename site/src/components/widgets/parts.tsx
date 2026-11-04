/** Shared instrument chrome for the widgets: one status lamp and one readout line. */

export function Status({ live }: { live: boolean }) {
  return (
    <span
      className="status"
      title={live ? "Running against the FastAPI backend" : "Backend offline — curated demo data"}
    >
      <span className={`dot${live ? " dot-live" : ""}`} aria-hidden />
      {live ? "live" : "demo"}
    </span>
  );
}

export function Foot({ items }: { items: (string | null | undefined)[] }) {
  return (
    <div className="widget-foot">
      <span className="instrument tnum">{items.filter((item) => item != null && item !== "").join(" · ")}</span>
    </div>
  );
}
