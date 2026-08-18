import {useEffect, useRef, useState} from 'react';

/**
 * Which rows of a scrolling list are actually on screen.
 *
 * This is what couples the split view's two halves: the list scrolls, this reports
 * the rows now in the viewport, and the map fits itself to them. Scrolling from the
 * Klang Valley down to Johor therefore walks the map down the peninsula, which is
 * the behaviour a list-*or*-map toggle cannot express at all.
 *
 * ## Why an observer rather than a scroll handler
 *
 * A scroll handler would have to measure every row against the container on every
 * frame. `IntersectionObserver` is told once what to watch and reports only what
 * changed, off the main thread's critical path — and it gets the awkward cases
 * right for free: rows hidden behind a sticky header, the container being resized,
 * the list being short enough that nothing scrolls at all.
 *
 * The rows announce themselves with `data-row-id`, so no ref has to be threaded
 * through the table for each one. `ids` is the dependency that re-registers them:
 * when the filtered list changes, the old `<tr>` elements are gone and the observer
 * has to be pointed at the new ones.
 *
 * ## The feedback loop this has to avoid
 *
 * Clicking a pin selects a genset, which scrolls its row into view, which changes
 * the visible set, which re-fits the map — away from the pin that was just clicked.
 * So a *programmatic* scroll suppresses reporting for a moment: `suppress()` returns
 * a token the caller holds across its `scrollIntoView`, and updates during that
 * window are dropped rather than queued. Only a scroll somebody performed moves the
 * map.
 */

/** How long a programmatic scroll stays suppressed, ms — a smooth scroll's length. */
const SUPPRESS_MS = 700;

export type VisibleRows = {
  /** Ids currently intersecting the scroll container, in the list's own order. */
  ids: Array<string>;
  /**
   * Call immediately *before* scrolling the list yourself.
   *
   * Reporting pauses for `SUPPRESS_MS`, so the scroll you caused doesn't come back
   * round as a request to move the map.
   */
  suppress: () => void;
};

export const useVisibleRowIds = (
  containerRef: React.RefObject<HTMLElement | null>,
  ids: Array<string>,
  /** Off in the views that have no map to drive, so nothing observes for nothing. */
  enabled: boolean,
): VisibleRows => {
  const [visible, setVisible] = useState<Array<string>>([]);
  const suppressedUntilRef = useRef(0);

  // The observer callback reads the current order to sort its results, and
  // re-creating the observer on every list change would throw away the rows it has
  // already seen. A ref keeps the callback current without that.
  const orderRef = useRef(ids);
  orderRef.current = ids;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || container === null) {
      // Cleared rather than left stale: a caller switching to the list-only view
      // should not keep a set of ids from the last time the map was up.
      setVisible([]);
      return;
    }

    const rows = container.querySelectorAll<HTMLElement>('[data-row-id]');
    if (rows.length === 0) {
      setVisible([]);
      return;
    }

    const onScreen = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.rowId;
          if (id === undefined) continue;
          if (entry.isIntersecting) onScreen.add(id);
          else onScreen.delete(id);
        }

        if (Date.now() < suppressedUntilRef.current) return;

        const next = orderRef.current.filter((id) => onScreen.has(id));
        // Compared by content, not identity: the observer fires on every partial
        // intersection change, and most of those leave the visible set alone. An
        // unconditional `setVisible` would re-fit the map on a two-pixel scroll.
        setVisible((previous) =>
          previous.length === next.length && previous.every((id, index) => id === next[index])
            ? previous
            : next,
        );
      },
      {
        root: container,
        // A row half under the sticky header is not one the reader is looking at.
        // 0.6 is what stops the map counting the row it is scrolling past.
        threshold: 0.6,
      },
    );

    for (const row of rows) observer.observe(row);
    return () => observer.disconnect();
    // `ids` by identity: the page hands over a memoised array, so this re-registers
    // exactly when the rendered rows have actually changed.
  }, [containerRef, ids, enabled]);

  const suppress = () => {
    suppressedUntilRef.current = Date.now() + SUPPRESS_MS;
  };

  return {ids: visible, suppress};
};
