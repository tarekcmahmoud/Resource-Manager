'use client';
import { useEffect, useState, type RefObject } from 'react';

/**
 * How many columns of at least --column-min fit in the element (1 to 6), plus its
 * width and column gap in pixels. Updates on resize.
 */
export function useColumnCount(ref: RefObject<HTMLElement | null>, fallback = 3) {
  const [m, setM] = useState({ n: fallback, width: 0, gap: 0 });
  useEffect(() => {
    const el = ref.current!;
    const measure = () => {
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap) || 0;
      const min = parseFloat(cs.getPropertyValue('--column-min')) || 232;
      const width = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const n = Math.max(1, Math.min(6, Math.floor((width + gap) / (min + gap))));
      setM((x) => (x.n === n && x.width === width && x.gap === gap ? x : { n, width, gap }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return m;
}
