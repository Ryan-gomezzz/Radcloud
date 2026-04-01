import { useEffect, useState } from "react";

/**
 * Animates numeric `end` from 0 over `durationMs`. Returns formatted display string.
 */
export function useCountUp(end, durationMs = 1500, enabled = true, decimals = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled || typeof end !== "number" || Number.isNaN(end)) {
      return undefined;
    }
    let startTs;
    let raf;
    const step = (ts) => {
      if (startTs == null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setValue(end);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, durationMs, enabled]);

  if (!enabled || typeof end !== "number" || Number.isNaN(end)) {
    if (typeof end !== "number" || Number.isNaN(end)) {
      return { display: "—", raw: 0 };
    }
    const rounded = decimals > 0 ? Number(end.toFixed(decimals)) : Math.round(end);
    return { display: rounded.toLocaleString(), raw: rounded };
  }
  const rounded = decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
  return { display: rounded.toLocaleString(), raw: rounded };
}
