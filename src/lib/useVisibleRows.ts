import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Which rows of a scrolling list are actually on screen.
 *
 * This is what couples the split view's two halves: the list scrolls, this reports
 * the rows now in view, and the map fits itself to them. Scrolling from the Klang
 * Valley down to Sarawak therefore walks the map across the country, which is the
 * behaviour a list-*or*-map toggle cannot express at all.
 *
 * ## Why this measures on scroll rather than using IntersectionObserver
 *
 * An observer was the first implementation and it is the obvious tool: told once what
 * to watch, reporting only what changed, and correct for free about rows behind a
 * sticky header. It did not survive contact with this screen.
 *
 * The rows are `<tr>` elements that React replaces whenever the filtered list
 * changes, so the observer has to be torn down and re-registered against the new
 * nodes. In practice the first observer reported its 11 visible rows, the effect
 * re-ran, and **the replacement observers never delivered their initial
 * notification** — so the sync worked once on first paint and then went silent for
 * the rest of the session. Chasing that meant reasoning about when an observer is
 * and is not obliged to report a target it has just been given, which is a subtle
 * contract to hang a visible feature on.
 *
 * Measuring rectangles on scroll has none of that. It reads whatever nodes exist at
 * the moment it runs, so node churn is not a case to handle: there is no
 * registration to go stale. The cost is real but small and bounded — one
 * `getBoundingClientRect` per row on a rAF-throttled tick, over a list of tens of
 * rows, only while the split view is open.
 *
 * ## The feedback loop this has to avoid
 *
 * Clicking a pin selects a genset, which scrolls its row into view, which changes
 * the visible set, which re-fits the map — away from the pin that was just clicked.
 * So a *programmatic* scroll suppresses reporting for a moment: the caller holds
 * `suppress()` across its `scrollIntoView`, and ticks inside that window are dropped
 * rather than queued. Only a scroll somebody performed moves the map.
 */

/** How long a programmatic scroll stays suppressed, ms — a smooth scroll's length. */
const SUPPRESS_MS = 700;

/**
 * How much of a row has to be in view to count.
 *
 * A row half under the sticky header is not one the reader is looking at, and
 * counting it would put the map a row ahead of the list on every scroll.
 */
const MIN_VISIBLE = 0.6;

/** The sticky header's height. Rows underneath it are covered, not visible. */
const HEADER_HEIGHT = 40;

export type VisibleRows = {
  /** Ids currently in view, in the list's own order. */
  ids: Array<string>;
  /**
   * Call immediately *before* scrolling the list yourself.
   *
   * Reporting pauses for `SUPPRESS_MS`, so the scroll you caused doesn't come back
   * round as a request to move the map.
   */
  suppress: () => void;
};

const sameIds = (left: Array<string>, right: Array<string>): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);

export const useVisibleRowIds = (
  containerRef: React.RefObject<HTMLElement | null>,
  ids: Array<string>,
  /** Off in the views that have no map to drive, so nothing measures for nothing. */
  enabled: boolean,
): VisibleRows => {
  const [visible, setVisible] = useState<Array<string>>([]);
  const suppressedUntilRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (container === null) return;
    if (Date.now() < suppressedUntilRef.current) return;

    const view = container.getBoundingClientRect();
    const top = view.top + HEADER_HEIGHT;
    const next: Array<string> = [];

    // Queried fresh every tick rather than held from an earlier render: these nodes
    // are replaced whenever the list is filtered, and reading them now is the whole
    // reason this approach has no stale-registration case.
    for (const row of container.querySelectorAll<HTMLElement>('[data-row-id]')) {
      const id = row.dataset.rowId;
      if (id === undefined) continue;

      const box = row.getBoundingClientRect();
      if (box.height === 0) continue;

      const shown = Math.min(box.bottom, view.bottom) - Math.max(box.top, top);
      if (shown / box.height >= MIN_VISIBLE) next.push(id);
    }

    // Compared by content, not identity: most scroll ticks leave the visible set
    // alone, and an unconditional set would re-fit the map on a two-pixel scroll.
    setVisible((previous) => (sameIds(previous, next) ? previous : next));
  }, [containerRef]);

  /** One measurement per frame at most, however many scroll events arrive. */
  const schedule = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || container === null) {
      // Cleared rather than left stale: a caller switching to the list-only view
      // should not keep a set of ids from the last time the map was up.
      setVisible([]);
      return;
    }

    // Measure now, so the map frames the rows already on screen rather than waiting
    // for somebody to scroll. `ids` in the deps is what re-measures after a filter
    // changes which rows exist.
    measure();

    container.addEventListener('scroll', schedule, {passive: true});
    // The container changes height when the cards above it wrap, which changes how
    // many rows are in view without any scrolling at all.
    const resize = new ResizeObserver(schedule);
    resize.observe(container);

    return () => {
      container.removeEventListener('scroll', schedule);
      resize.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [containerRef, ids, enabled, measure, schedule]);

  const suppress = () => {
    suppressedUntilRef.current = Date.now() + SUPPRESS_MS;
  };

  return {ids: visible, suppress};
};
