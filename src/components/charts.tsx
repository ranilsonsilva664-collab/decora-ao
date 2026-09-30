import { brlShort } from "../lib/format";

export function BarChart({
  data,
  color = "#a98fe0",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-44 w-full items-end justify-between gap-2 overflow-hidden">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2 min-w-0">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-xl transition-all duration-700"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: `linear-gradient(180deg, ${color}, ${color}66)`,
                minHeight: 6,
              }}
              title={brlShort(d.value)}
            />
          </div>
          <span className="text-[10px] font-medium text-stone-400 truncate max-w-full">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DualLineChart({
  series,
  labels,
}: {
  series: { name: string; color: string; data: number[] }[];
  labels: string[];
}) {
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1);
  const W = 320;
  const H = 150;
  const pad = 10;
  const stepX = (W - pad * 2) / Math.max(labels.length - 1, 1);
  const path = (data: number[]) =>
    data
      .map((v, i) => {
        const x = pad + i * stepX;
        const y = H - pad - (v / max) * (H - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-48">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad} x2={W - pad} y1={pad + g * (H - pad * 2)} y2={pad + g * (H - pad * 2)} stroke="#eee5f5" strokeWidth="1" />
        ))}
        {series.map((s, si) => (
          <g key={si}>
            <path d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => {
              const x = pad + i * stepX;
              const y = H - pad - (v / max) * (H - pad * 2);
              return <circle key={i} cx={x} cy={y} r="3" fill="white" stroke={s.color} strokeWidth="2" />;
            })}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between px-2">
        {labels.map((l, i) => (
          <span key={i} className="text-[10px] font-medium text-stone-400">{l}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HBars({
  data,
}: {
  data: { label: string; value: number; emoji?: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const colors = ["#a98fe0", "#d18a7a", "#c9a45c", "#e7b4ae", "#c9b6ee", "#e0a193"];
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const isImg = d.emoji && (d.emoji.startsWith("http") || d.emoji.startsWith("data:"));
        return (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-stone-600 flex items-center gap-1.5 min-w-0 flex-1">
                {isImg ? (
                  <img
                    src={d.emoji}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-md object-cover border border-pink-100"
                  />
                ) : (
                  <span className="shrink-0 text-sm">
                    {d.emoji && d.emoji.length <= 4 ? d.emoji : "🎀"}
                  </span>
                )}
                <span className="truncate">{d.label}</span>
              </span>
              <span className="text-stone-400 shrink-0 font-semibold">{d.value}x</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(d.value / max) * 100}%`, background: colors[i % colors.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
