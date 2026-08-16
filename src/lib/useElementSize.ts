import {useLayoutEffect, useState} from 'react';
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
 *
 * ## Why it measures once itself instead of waiting for the observer
 *
 * `ResizeObserver` is specified to deliver an initial callback when you observe an
 * element, and in a browser it does. It is not, however, something to *depend* on:
 * an environment that throttles or never delivers that first callback leaves every
 * caller stuck on `{0, 0}` forever — which for `SiteDiagram` means a drawing that
 * silently never scales, and for the analysis chart one that never draws. The
 * in-app preview browser this prototype is reviewed in behaves exactly that way.
 *
 * So the element is measured directly the moment the ref attaches, and the observer
 * is only what keeps that measurement current. The measure runs in a layout effect
 * rather than a passive one so it lands **before paint** — measuring after paint
 * would show one frame at the wrong size, which on the site diagram is a visible
 * flash of the unscaled canvas.
 */
export const useElementSize = (
  ref: RefObject<HTMLElement | null>,
): {width: number; height: number} => {
  const [size, setSize] = useState({width: 0, height: 0});

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;

    // Rounded, and only committed on a real change. Sub-pixel layout jitter would
    // otherwise re-render the chart on every frame of a window drag.
    const commit = (width: number, height: number) => {
      setSize((previous) =>
        Math.round(width) === previous.width && Math.round(height) === previous.height
          ? previous
          : {width: Math.round(width), height: Math.round(height)},
      );
    };

    const measure = () => {
      const box = element.getBoundingClientRect();
      commit(box.width, box.height);
    };

    // A `resize` event can arrive before the new viewport has been laid out, so
    // measuring inside the handler reads the *old* box and commits nothing — the
    // element then keeps a stale size until something else disturbs it. One frame
    // later the layout is settled.
    let frame = 0;
    const measureNextFrame = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect;
      commit(next.width, next.height);
    });
    observer.observe(element);

    // The coarse fallback, for the same reason the initial measure exists: where the
    // observer is unreliable, a window resize is the one signal that still arrives,
    // and it covers the case this prototype is actually reviewed in — somebody
    // dragging the window between desktop and phone widths to see both layouts.
    // Redundant in a browser that delivers observer callbacks, and cheap when it is:
    // `commit` drops any measurement that did not change.
    window.addEventListener('resize', measureNextFrame);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureNextFrame);
      cancelAnimationFrame(frame);
    };
  }, [ref]);

  return size;
};
