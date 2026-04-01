import { useMemo } from "react";
import { useThemeStore } from "../stores/themeStore";

export function useChartTheme() {
  const theme = useThemeStore((s) => s.theme);

  return useMemo(() => {
    const isLight = theme === "light";
    return {
      tooltipStyle: {
        backgroundColor: isLight ? "#ffffff" : "#16161f",
        border: isLight ? "1px solid #e2e8f0" : "1px solid #2a2a3e",
        borderRadius: "8px",
        color: isLight ? "#0f172a" : "#d1d5db",
      },
      axisTick: { fill: isLight ? "#64748b" : "#6b7280", fontSize: 11 },
      gridStroke: isLight ? "#e2e8f0" : "#2a2a3e",
      legendColor: isLight ? "#64748b" : "#6b7280",
    };
  }, [theme]);
}
