'use client';
import { useEffect, useState, type RefObject } from 'react';

/** How many columns of at least --column-min fit in the element, 1 to 6. Updates on resize. */
export function useColumnCount(ref: RefObject<HTMLElement | null>, fallback = 3) {
  const [n, setN] = useState(fallback);
  useEffect(() => {
    const el = ref.current!;
    const measure = () => {
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap) || 0;
      const min = parseFloat(cs.getPropertyValue('--column-min')) || 232;
      setN(Math.max(1, Math.min(6, Math.floor((el.clientWidth + gap) / (min + gap)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return n;
}
