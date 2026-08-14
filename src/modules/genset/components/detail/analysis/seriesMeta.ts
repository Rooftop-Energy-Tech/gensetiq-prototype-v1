/**
 * The two slots a series can occupy, and the colour that identifies it.
 *
 * Teal is the app's own accent and takes the first slot; the second is the
 * violet the home page already spends on fuel. Reusing an established hue rather
 * than introducing a third is deliberate — these two are the only pair the tab
 * ever draws, and the reader has seen both before.
 *
 * Colour is the *only* thing tying a trace to its axis: the left scale, the left
 * legend chip and the left line are all teal, the right ones all violet. That is
 * why there is no dashed-versus-solid distinction as well — one channel, used
 * consistently, is easier to read than two used redundantly.
 */
export type SeriesSlot = {
  /** SVG, for the trace and the crosshair's dot. */
  stroke: string;
  fill: string;
  /** DOM, for the legend chip's dot. */
  background: string;
  text: string;
  /** Which side of the plot this slot's scale is drawn on. */
  axis: 'left' | 'right';
};

export const SERIES_SLOTS: [SeriesSlot, SeriesSlot] = [
  {
    stroke: 'stroke-teal',
    fill: 'fill-teal',
    background: 'bg-teal',
    text: 'text-teal',
    axis: 'left',
  },
  {
    stroke: 'stroke-fuel',
    fill: 'fill-fuel',
    background: 'bg-fuel',
    text: 'text-fuel',
    axis: 'right',
  },
];

/** Two at a time, because a dual-axis chart has exactly two axes. */
export const MAX_SERIES = SERIES_SLOTS.length;
