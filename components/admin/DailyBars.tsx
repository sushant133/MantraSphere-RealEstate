/**
 * Single-series bar chart (server-rendered SVG): one hue from the brand
 * token, no legend (the title names the series), rounded data-ends anchored
 * to the baseline, 2px gaps, a native hover tooltip per bar, and a table view.
 */
export function DailyBars({ title, data }: { title: string; data: { day: string; count: number }[] }) {
  const W = 720;
  const H = 180;
  const padL = 28;
  const padB = 22;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = (W - padL) / data.length;
  const barW = Math.max(2, step - 2); // 2px surface gap between bars
  const y = (v: number) => (H - padB) * (1 - v / max);
  const ticks = [0, Math.ceil(max / 2), max];
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <figure className="rounded-2xl border bg-card p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{total} in {data.length} days</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: ${total} in total`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * step + 1;
          const h = Math.max(0, H - padB - y(d.count));
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.day} className="[&:hover>path]:opacity-80">
              <title>{`${fmt(d.day)}: ${d.count}`}</title>
              {/* Hit area larger than the mark. */}
              <rect x={x - 1} y={0} width={step} height={H - padB} fill="transparent" />
              {h > 0 ? (
                <path
                  d={`M${x},${H - padB} V${H - padB - h + r} Q${x},${H - padB - h} ${x + r},${H - padB - h} H${x + barW - r} Q${x + barW},${H - padB - h} ${x + barW},${H - padB - h + r} V${H - padB} Z`}
                  fill="var(--primary)"
                />
              ) : null}
              {i % 7 === 0 ? (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
                  {fmt(d.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="tap inline-flex cursor-pointer items-center text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th scope="col" className="py-1 font-semibold">Day</th>
              <th scope="col" className="py-1 font-semibold">New listings</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t">
                <td className="py-1">{fmt(d.day)}</td>
                <td className="py-1">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
