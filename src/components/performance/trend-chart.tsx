"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/queries/performance";

interface TrendRow extends TrendPoint {
  accuracyPct: number;
  label: string;
}

/**
 * Accuracy over time.
 *
 * One series, one colour, a faint grid — the brief is explicit that dashboards
 * should not be colourful, and an accuracy trend has nothing to gain from a
 * second hue. Y is pinned to 0–100 so a good week and a bad week are visually
 * comparable rather than each being auto-scaled to fill the box.
 */
export function TrendChart({
  data,
  label = "Accuracy",
}: {
  data: TrendPoint[];
  label?: string;
}) {
  const points = data.map((d) => ({
    ...d,
    accuracyPct: Math.round(d.accuracy * 100),
    label: new Date(`${d.date}T00:00:00+08:00`).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6846d6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#6846d6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#e5dff7" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6b6291", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#e5dff7" }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "#6b6291", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5dff7",
              boxShadow: "0 10px 30px rgba(17,26,77,.09)",
              fontSize: 13,
              fontFamily: "var(--font-nunito)",
            }}
            labelStyle={{ color: "#22154a", fontWeight: 700 }}
            formatter={(value, _name, item) => [
              `${value}% · ${(item?.payload as TrendRow | undefined)?.attempts ?? 0} questions`,
              label,
            ]}
          />
          <Area
            type="monotone"
            dataKey="accuracyPct"
            stroke="#6846d6"
            strokeWidth={2.5}
            fill="url(#accuracyFill)"
            dot={{ r: 3, fill: "#6846d6", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
