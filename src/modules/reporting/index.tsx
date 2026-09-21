import {useMemo, useState} from 'react';
import {DownloadIcon} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {downloadText} from '@/lib/download';
import {historyStart} from '@/modules/genset/data/history';
import {EXPORTS, exportFilename} from './exports';
import type {ExportRange} from './exports';

/**
 * `/reporting` — the app's way out of the app.
 *
 * Every figure here is already drawn on some screen. What no screen can do is hand
 * somebody a file, and that is the whole job: an invoice is settled in a spreadsheet,
 * and "what did the fleet do last quarter" cannot be answered with a scroll position.
 * So this is three exports and a date range, not a fourth set of charts — see the
 * note in `exports.ts` for why re-plotting was the wrong answer.
 *
 * ## The range is clamped to what the app actually holds
 *
 * `historyStart()` is the oldest instant the history layer can speak about, and a
 * reader who picks a date before it would get an empty file rather than an error —
 * which reads as "the fleet did nothing then" instead of "we do not hold this". The
 * picker refuses to go earlier, and the note under it says why. The one machine with
 * a measured record reaches further back than that horizon, which is why the note
 * names it rather than pretending the edge is uniform.
 */

const DAY = 86_400_000;

/** `2026-09-21`, for the date inputs, in the reader's own timezone. */
const inputDay = (at: number): string => {
  const t = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};

/** Midnight local at the start of a `yyyy-mm-dd`, and midnight the following day. */
const dayStart = (value: string): number => new Date(`${value}T00:00:00`).getTime();

export const ReportingPage = () => {
  const now = useMemo(() => Date.now(), []);
  const [from, setFrom] = useState(() => inputDay(now - 30 * DAY));
  const [to, setTo] = useState(() => inputDay(now));

  // Half-open: the range runs to midnight the morning *after* the day picked, so a
  // range drawn to the 16th includes everything that happened on the 16th. The same
  // convention `runsCsv` holds, and the reason it prints the last instant rather
  // than the boundary.
  const range: ExportRange = {from: dayStart(from), to: dayStart(to) + DAY};
  const valid = range.to > range.from;

  const counts = useMemo(
    () =>
      valid
        ? EXPORTS.map((spec) => ({kind: spec.kind, rows: spec.build(range).rows}))
        : EXPORTS.map((spec) => ({kind: spec.kind, rows: 0})),
    // `range` is rebuilt every render; the two strings are what actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, valid],
  );

  const handleDownload = (kind: (typeof EXPORTS)[number]['kind']) => {
    const spec = EXPORTS.find((entry) => entry.kind === kind);
    if (spec === undefined) return;
    downloadText(exportFilename(kind, range), spec.build(range).csv, 'text/csv');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-3 pb-4">
      <section className="flex flex-col gap-2 rounded-md border border-subtle bg-element p-3">
        <h2 className="text-sm font-medium text-primary">Range</h2>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-secondary">
            From
            <input
              type="date"
              value={from}
              min={inputDay(historyStart())}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded border border-subtle bg-canvas px-2 py-1.5 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-outline"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-secondary">
            To
            <input
              type="date"
              value={to}
              min={from}
              max={inputDay(now)}
              onChange={(event) => setTo(event.target.value)}
              className="rounded border border-subtle bg-canvas px-2 py-1.5 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-outline"
            />
          </label>
        </div>

        <p className="text-xs text-tertiary">
          The history layer holds {new Date(historyStart()).toLocaleDateString('en-MY')} onward.
          BRF 9540 is the exception — its record is measured and reaches back to May.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-primary">Exports</h2>

        <ul className="flex flex-col gap-2">
          {EXPORTS.map((spec) => {
            const rows = counts.find((entry) => entry.kind === spec.kind)?.rows ?? 0;

            return (
              <li
                key={spec.kind}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-subtle bg-element p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium text-primary">{spec.label}</p>
                  <p className="text-xs text-secondary">{spec.blurb}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {/* The row count before the button, because an export that would
                      come back empty is worth knowing about before the file is
                      open in Excel. */}
                  <span className="text-xs text-tertiary tabular-nums">
                    {rows.toLocaleString('en-MY')} {rows === 1 ? 'row' : 'rows'}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={!valid || rows === 0}
                    onClick={() => handleDownload(spec.kind)}
                  >
                    <DownloadIcon aria-hidden="true" />
                    CSV
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
