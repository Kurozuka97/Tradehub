"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function CryptoSparkline({ data }) {
  if (!data?.length) return null;
  const chartData = data.map((price, i) => ({ price, index: i }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="price" stroke="#4d9fff" dot={false} strokeWidth={1} />
      </LineChart>
    </ResponsiveContainer>
  );
}
