"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

const SHORT: Record<string, string> = {
  BM: "BM",
  ENGLISH: "Eng",
  MATH: "Math",
  SCIENCE: "Sci",
  SEJARAH: "Sej",
};

/**
 * Subject mastery as a radar.
 *
 * A radar earns its place here specifically because the question is "where am I
 * lopsided?" — the shape answers that at a glance in a way five separate bars
 * do not. It stays on the brand hue rather than picking up the subject colours;
 * five hues in one small polygon would be unreadable.
 */
export function MasteryRadar({
  subjects,
}: {
  subjects: { code: string; mastery: number }[];
}) {
  const data = subjects.map((s) => ({
    subject: SHORT[s.code] ?? s.code,
    value: Math.round(s.mastery * 100),
  }));

  return (
    <div className="h-[196px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e5dff7" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#6b6291", fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke="#6846d6"
            strokeWidth={2}
            fill="#6846d6"
            fillOpacity={0.22}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
