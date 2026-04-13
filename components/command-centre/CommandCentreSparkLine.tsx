"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

export default function CommandCentreSparkLine({ data }: { data: number[] }) {
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke="var(--text-muted)" strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-primary)",
          }}
          formatter={(v) => [`${Number(v).toFixed(1)}%`, ""]}
          labelFormatter={() => ""}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
