import {cn} from '@/lib/utils';

/** Segments in the design's tank glyph. */
const SEGMENTS = 8;

/**
 * The little violet tank beside the fuel figures.
 *
 * Eight stacked bars filling from the bottom, which quantises the level to
 * eighths — and that is the point rather than a limitation. Next to it sits the
 * exact figure ("1,763 L | 72%"); the glyph's job is the at-a-glance read, and a
 * continuous column would invite the eye to measure it and disagree with the
 * number by a percent.
 *
 * The topmost filled segment is one step lighter — a meniscus. It comes straight
 * from the design and it earns its place: it marks *where* the level is, which a
 * flat column of one colour leaves you counting bars to find.
 */
export const FuelTank = ({fraction}: {fraction: number}) => {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * SEGMENTS);

  return (
    <div
      className="flex h-15 w-[46px] flex-col-reverse justify-between overflow-hidden rounded-md px-[5px] py-1.5"
      aria-hidden="true"
    >
      {Array.from({length: SEGMENTS}, (_, index) => (
        <div
          key={index}
          className={cn(
            'h-1.5 w-full rounded-[3px]',
            index < filled ? 'bg-fuel' : 'bg-tertiary',
            // `index + 1 === filled` is the surface of the diesel.
            index + 1 === filled && 'bg-fuel-tip',
          )}
        />
      ))}
    </div>
  );
};
