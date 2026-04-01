import { ResponsiveContainer } from "recharts";

export function ChartWrapper({ height = 280, children }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      {/* Fixed outer height + min-w-0 avoids ResponsiveContainer width/height -1 in flex/hidden tabs */}
      <div className="w-full min-w-0" style={{ height, minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
