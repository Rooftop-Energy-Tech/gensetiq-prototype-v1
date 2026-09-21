import {
  background,
  battery,
  border,
  fuel,
  severity,
  sidebar,
  status,
  text,
} from '@/styles/colors';
import type {ColorMap, ColorMode} from '@/styles/colors';
import {Section, Specimen} from '@/modules/gallery/frame';

/**
 * Every colour token in the palette, both modes side by side.
 *
 * This is the half of the gallery that has no Storybook equivalent, and the
 * reason the whole thing is worth having. The palette in `styles/colors.ts` is
 * the app's real design system — brands recolour through it, `figmaMap()` maps it
 * onto Figma variables, and an org skill diffs it against the live file — and
 * until now the only way to see a token was to find something drawn in it.
 *
 * The groups come from `colors.ts`'s own exports rather than from a list here, so
 * a token added there shows up on this page without anybody being told.
 *
 * ## Why both modes are drawn from the table rather than by toggling the class
 *
 * The swatches take their fill from `token.light` / `token.dark` as literals,
 * not from the CSS variable. Reading the variable would show only whichever mode
 * the page is currently in, and the pair is the interesting thing: a token that
 * barely moves between modes and one that inverts are different kinds of token,
 * and the difference is invisible one mode at a time.
 *
 * The theme switch in the header is still worth having — it is how you check that
 * the *components* survive the dark palette, which is a different question and
 * one this build has never really answered, since `main.tsx` ships light-only.
 */

const GROUPS: ReadonlyArray<{title: string; note: string; map: ColorMap}> = [
  {
    title: 'Background surfaces',
    note: 'The tier ladder — canvas behind element behind overlay — plus the brand and button fills.',
    map: background(),
  },
  {title: 'Text', note: 'The three-step text scale and its muted foreground.', map: text()},
  {title: 'Borders', note: 'subtle, default, strong — in that order of weight.', map: border()},
  {title: 'Sidebar', note: 'The rail, which a brand recolours independently of the app.', map: sidebar()},
  {title: 'Run states', note: 'Running, idle, offline — the genset state colours.', map: status()},
  {title: 'Fuel', note: 'The tank body and the meniscus on its topmost filled bar.', map: fuel()},
  {title: 'Battery', note: 'Healthy charge only — low and critical come from the severity group.', map: battery()},
  {title: 'Severity', note: 'Critical, warning, ok. Everything that ranks an alarm reads these.', map: severity()},
];

/**
 * One token: both values as chips, the Tailwind name, and the Figma variable.
 *
 * The Figma column is what makes this a bridge rather than a poster — it is the
 * `figma` field already carried on every token, and it is the answer to "which
 * utility is this variable" without opening the file.
 */
const TokenRow = ({
  name,
  light,
  dark,
  figma,
}: {
  name: string;
  light: string;
  dark: string;
  figma: string;
}) => (
  <div className="flex items-center gap-3 rounded-md border border-subtle bg-element px-2.5 py-2">
    <div className="flex shrink-0 overflow-hidden rounded-md border border-default">
      <Swatch value={light} mode="light" />
      <Swatch value={dark} mode="dark" />
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <code className="truncate font-mono text-xs text-primary">{name}</code>
      <span className="truncate font-mono text-[11px] leading-4 text-tertiary">
        {figma === '' ? 'code-only' : figma}
      </span>
    </div>
    <div className="flex shrink-0 flex-col items-end">
      <code className="font-mono text-[11px] leading-4 text-secondary tabular-nums">{light}</code>
      <code className="font-mono text-[11px] leading-4 text-tertiary tabular-nums">{dark}</code>
    </div>
  </div>
);

/**
 * Checkerboard behind the fill, because several tokens carry an alpha channel —
 * `outline` is a grey at 50% and `fill` tints at 8% — and a translucent chip on
 * an opaque card reads as a solid colour that happens to be pale.
 */
const Swatch = ({value, mode}: {value: string; mode: ColorMode}) => (
  <span
    title={`${mode}: ${value}`}
    className="size-9 bg-[length:8px_8px] bg-[position:0_0,4px_4px]"
    style={{
      backgroundImage: `linear-gradient(${value}, ${value}), repeating-conic-gradient(#d4d4d8 0% 25%, #fafafa 0% 50%)`,
    }}
  />
);

export const TokensSection = () => (
  <Section
    id="tokens"
    title="Colour tokens"
    blurb="src/styles/colors.ts — the whole palette, light value over dark, with the Figma variable each one maps to. Groups are read from the module's own exports, so this cannot go stale."
  >
    {GROUPS.map((group) => (
      <Specimen
        key={group.title}
        name={group.title}
        source={`${Object.keys(group.map).length} tokens`}
        note={group.note}
      >
        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {Object.entries(group.map).map(([name, token]) => (
            <TokenRow
              key={name}
              name={name}
              light={token.light}
              dark={token.dark}
              figma={token.figma}
            />
          ))}
        </div>
      </Specimen>
    ))}
  </Section>
);
