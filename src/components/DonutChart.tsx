import type { DonutSlice } from "../lib/weighting";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Filled ring sector; angles in degrees, clockwise from start → end. */
function ringSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  let sweep = endDeg - startDeg;
  if (sweep <= 0) sweep += 360;
  // Avoid full-circle arc edge case
  if (sweep >= 359.99) sweep = 359.99;
  const end = startDeg + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, outerR, startDeg);
  const o1 = polar(cx, cy, outerR, end);
  const i1 = polar(cx, cy, innerR, end);
  const i0 = polar(cx, cy, innerR, startDeg);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

type Arc = DonutSlice & {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  side: "left" | "right";
  rim: { x: number; y: number };
};

type Placed = Arc & {
  labelX: number;
  labelY: number;
  attachX: number;
  attachY: number;
};

function placeColumn(
  items: Arc[],
  side: "left" | "right",
  labelX: number,
  attachX: number,
): Placed[] {
  return items.map((a) => ({
    ...a,
    side,
    labelX,
    labelY: a.rim.y,
    attachX,
    attachY: a.rim.y,
  }));
}

function leaderPath(
  rimX: number,
  rimY: number,
  attachX: number,
  attachY: number,
): string {
  const dx = attachX - rimX;
  const dy = attachY - rimY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const signX = Math.sign(dx) || 1;

  if (absDy < 4 || Math.abs(absDx - absDy) < 6) {
    return `M ${rimX} ${rimY} L ${attachX} ${attachY}`;
  }

  if (absDx > absDy) {
    const bendX = rimX + signX * (absDx - absDy);
    return `M ${rimX} ${rimY} L ${bendX} ${rimY} L ${attachX} ${attachY}`;
  }

  const bendX = rimX + signX * absDx;
  return `M ${rimX} ${rimY} L ${bendX} ${rimY} L ${attachX} ${attachY}`;
}

export function DonutChart({
  slices,
  total,
  title,
  size = 244,
}: {
  slices: DonutSlice[];
  total: number;
  title: string;
  size?: number;
}) {
  const colW = 172;
  const gap = 26;
  const padY = 20;
  const vbW = colW + gap + size + gap + colW;
  const vbH = size + padY * 2;

  const active = slices.filter((s) => s.included && s.weight > 0 && s.pct > 0);
  const excluded = slices.filter((s) => !s.included || s.weight <= 0);

  const cx = colW + gap + size / 2;
  const cy = vbH / 2;
  const band = size * 0.16;
  const midR = size * 0.34;
  const outerR = midR + band / 2;
  const innerR = Math.max(4, midR - band / 2);
  const rimR = outerR;

  let cursor = 0;
  const arcs: Arc[] = active.map((s) => {
    const startAngle = -90 + (cursor / 100) * 360;
    cursor += s.pct;
    const endAngle = -90 + (cursor / 100) * 360;
    const midAngle = (startAngle + endAngle) / 2;
    const side: "left" | "right" =
      Math.cos((midAngle * Math.PI) / 180) >= 0 ? "right" : "left";
    return {
      ...s,
      startAngle,
      endAngle,
      midAngle,
      side,
      rim: polar(cx, cy, rimR, midAngle),
    };
  });

  const leftX = 6;
  const rightX = vbW - colW + 6;
  const leftAttachX = leftX + colW - 14;
  const rightAttachX = rightX;

  const placed = [
    ...placeColumn(
      arcs.filter((a) => a.side === "left"),
      "left",
      leftX,
      leftAttachX,
    ),
    ...placeColumn(
      arcs.filter((a) => a.side === "right"),
      "right",
      rightX,
      rightAttachX,
    ),
  ];

  return (
    <div className="donut-wrap">
      <svg
        width="100%"
        viewBox={`0 0 ${vbW} ${vbH}`}
        aria-label={title}
        className="donut-svg"
      >
        <circle
          cx={cx}
          cy={cy}
          r={(innerR + outerR) / 2}
          fill="none"
          stroke="#ebe4d8"
          strokeWidth={outerR - innerR}
        />
        {arcs.map((a) => (
          <path
            key={a.key}
            d={ringSector(cx, cy, innerR, outerR, a.startAngle, a.endAngle)}
            fill={a.color}
            stroke="none"
          />
        ))}

        {placed.map((a) => (
          <g key={`callout-${a.key}`} className="donut-callout">
            <path
              d={leaderPath(a.rim.x, a.rim.y, a.attachX, a.attachY)}
              fill="none"
              stroke={a.color}
              strokeWidth={1.5}
              strokeLinecap="butt"
            />
            <foreignObject
              x={a.labelX}
              y={a.labelY - 16}
              width={colW - 10}
              height={36}
            >
              <div
                className={`donut-callout-box ${a.side}`}
                style={{ borderColor: a.color }}
              >
                <span className="callout-label">{a.label}</span>
                <span className="callout-pct" style={{ color: a.color }}>
                  {a.pct.toFixed(1)}% · {a.weight}
                </span>
              </div>
            </foreignObject>
          </g>
        ))}

        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="currentColor"
          fontSize={11}
        >
          Total
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="currentColor"
          fontSize={20}
          fontWeight={700}
        >
          {total}
        </text>
      </svg>

      {excluded.length > 0 && (
        <p className="donut-excluded muted">
          Not in this donut: {excluded.map((s) => s.label).join(" · ")}
        </p>
      )}
    </div>
  );
}
