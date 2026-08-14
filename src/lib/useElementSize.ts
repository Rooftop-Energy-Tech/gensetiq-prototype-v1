import {useEffect, useState} from 'react';
import type {RefObject} from 'react';

/**
 * An element's rendered size in CSS pixels, kept current across resizes.
 *
 * The analysis chart needs this because it is drawn in pixel coordinates rather
 * than a scaled `viewBox`. A `viewBox` with `preserveAspectRatio="none"` would
 * make it responsive for free, and would also stretch every axis label and tick
 * horizontally — text that is 30% wide on one screen and 130% on another. Laying
 * out against real pixels is the only way the type stays type.
 *
 * `{width: 0, height: 0}` on the first render, before the ref is attached. Every
 * caller has to handle that anyway: a chart cannot be drawn into an unknown box.
 */
export const useElementSize = (
  ref: RefObject<HTMLElement | null>,
): {width: number; height: number} => {
  const [size, setSize] = useState({width: 0, height: 0});

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      // Rounded, and only committed on a real change. Sub-pixel layout jitter
      // would otherwise re-render the chart on every frame of a window drag.
      setSize((previous) =>
        Math.round(box.width) === previous.width && Math.round(box.height) === previous.height
          ? previous
          : {width: Math.round(box.width), height: Math.round(box.height)},
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};
