import type {VariantProps} from 'class-variance-authority';
import {CommandIcon, PlusIcon, SearchIcon, Trash2Icon} from 'lucide-react';
import {useState} from 'react';

import {Badge} from '@/components/ui/badge';
import type {badgeVariants} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import type {buttonVariants} from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {Bench, Section, Specimen, Variant} from '@/modules/gallery/frame';

/**
 * `src/components/ui` — the eight Radix-backed primitives everything else is
 * built out of.
 *
 * The variant lists below are tied to each component's `cva` union by a
 * `Record<Variant, true>`, so a variant added or removed in `button.tsx` fails
 * `bun run typecheck` until this file agrees. See the note above `exhaustive`.
 */

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

/**
 * The variant lists, checked against the `cva` unions at **compile time**.
 *
 * `Record<ButtonVariant, true>` has to name every key of the union: add a variant
 * to `button.tsx` and `bun run typecheck` fails here until it is listed, remove
 * one and the stale entry fails the same way. So the bench cannot silently fall
 * behind the component, which is the one thing a gallery has to get right — a
 * component missing from it is worse than no gallery, because a reader trusts it.
 *
 * This started out reading the keys off `buttonVariants.config` at runtime, which
 * would have needed no list at all. `cva` does not expose its config on the
 * returned function, so that read produced `undefined`, the fallback produced an
 * empty array, and both benches rendered nothing at all. The type-level check is
 * the better trade anyway: it fails in CI rather than in a browser, and it fails
 * loudly instead of drawing an empty box.
 */
const exhaustive = <K extends string>(keys: Record<K, true>): ReadonlyArray<K> =>
  Object.keys(keys) as Array<K>;

const BUTTON_VARIANTS = exhaustive<ButtonVariant>({
  default: true,
  primary: true,
  destructive: true,
  outline: true,
  secondary: true,
  ghost: true,
  link: true,
});

const BUTTON_SIZES = exhaustive<ButtonSize>({
  default: true,
  xs: true,
  sm: true,
  lg: true,
  icon: true,
  'icon-xs': true,
  'icon-sm': true,
  'icon-lg': true,
});

const BADGE_VARIANTS = exhaustive<BadgeVariant>({
  default: true,
  secondary: true,
  outline: true,
  element: true,
});

const BADGE_SIZES = exhaustive<BadgeSize>({sm: true, md: true});

const isIconSize = (size: ButtonSize): boolean => size.startsWith('icon');

export const PrimitivesSection = () => {
  const [tab, setTab] = useState('overview');

  return (
    <Section
      id="primitives"
      title="Primitives"
      blurb="src/components/ui — the Radix-backed layer. Every variant of each component, with the lists checked against the cva unions at compile time so the bench cannot fall behind the code."
    >
      <Specimen
        name="Button"
        source="@/components/ui/button"
        note="The hover overlay is an ::after pseudo-element, not a background swap — which is why the brand variant needs its own brand-button-hover token rather than the base's."
      >
        <Bench>
          {BUTTON_VARIANTS.map((variant) => (
            <Variant key={variant} label={`variant="${variant}"`}>
              <Button variant={variant}>Log service</Button>
            </Variant>
          ))}
        </Bench>
        <Bench>
          {BUTTON_SIZES.map((size) => (
            <Variant key={size} label={`size="${size}"`}>
              <Button variant="outline" size={size}>
                {isIconSize(size) ? <PlusIcon aria-hidden="true" /> : 'Dispatch'}
              </Button>
            </Variant>
          ))}
        </Bench>
        <Bench>
          <Variant label="with leading icon">
            <Button variant="outline">
              <PlusIcon aria-hidden="true" />
              Add genset
            </Button>
          </Variant>
          <Variant label="disabled">
            <Button disabled>Log service</Button>
          </Variant>
          <Variant label="destructive + icon">
            <Button variant="destructive">
              <Trash2Icon aria-hidden="true" />
              Remove
            </Button>
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="Badge"
        source="@/components/ui/badge"
        note="secondary is borderless and needs a card behind it; element brings its own surface and edge, for a badge sitting directly on bg-canvas."
      >
        <Bench>
          {BADGE_VARIANTS.map((variant) => (
            <Variant key={variant} label={`variant="${variant}"`}>
              <Badge variant={variant}>Carrying</Badge>
            </Variant>
          ))}
          {BADGE_SIZES.map((size) => (
            <Variant key={size} label={`size="${size}"`}>
              <Badge variant="element" size={size}>
                44.6 °C
              </Badge>
            </Variant>
          ))}
        </Bench>
      </Specimen>

      <Specimen
        name="Input · InputGroup"
        source="@/components/ui/input, @/components/ui/input-group"
        note="InputGroup is not a wrapped Input — the border and focus ring live on the group so the addons sit inside one outline. Wrapping would double the border."
      >
        <Bench wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <Variant label="Input" className="w-full">
              <Input placeholder="Hour-meter reading" className="w-full" />
            </Variant>
            <Variant label='Input type="number" — no spinner' className="w-full">
              <Input type="number" defaultValue={4182} className="w-full" />
            </Variant>
            <Variant label="Input disabled" className="w-full">
              <Input placeholder="Serial" disabled className="w-full" />
            </Variant>
            <Variant label="InputGroup with both addons" className="w-full">
              <InputGroup className="w-full">
                <InputGroupAddon>
                  <SearchIcon aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search sites" />
                <InputGroupAddon className="gap-0.5 text-xs">
                  <CommandIcon className="size-3" aria-hidden="true" />K
                </InputGroupAddon>
              </InputGroup>
            </Variant>
          </div>
        </Bench>
      </Specimen>

      <Specimen
        name="Tabs"
        source="@/components/ui/tabs"
        note="The detail shells do not use this — their tabs are router links, so the browser's back button works. This is for tabs within one screen."
      >
        <Bench wide>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="alarms">Alarms</TabsTrigger>
              <TabsTrigger value="service" disabled>
                Service
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-2 text-sm text-secondary">
              Panel for the active trigger. The disabled one shows the muted state.
            </TabsContent>
            <TabsContent value="alarms" className="pt-2 text-sm text-secondary">
              Second panel — state is the caller's, so this is a controlled pair.
            </TabsContent>
          </Tabs>
        </Bench>
      </Specimen>

      <Specimen
        name="Dialog · Popover · Tooltip"
        source="@/components/ui/dialog, popover, tooltip"
        note="All three portal out of the layout, so they are worth opening here — a clipping bug from an overflow-hidden ancestor will not reproduce on a bench this flat."
      >
        <Bench>
          <Variant label="Dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Log a service</DialogTitle>
                <DialogDescription>
                  Portalled, max-h-[90vh], scrolls internally past that.
                </DialogDescription>
                <div className="flex justify-end gap-2 pt-4">
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button>Save</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </Variant>
          <Variant label="Popover">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Open popover</Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-3 text-sm text-secondary">
                Anchored to its trigger. FilterSelect below is the app's one real use.
              </PopoverContent>
            </Popover>
          </Variant>
          <Variant label="Tooltip">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Provider lives in __root.tsx</TooltipContent>
            </Tooltip>
          </Variant>
        </Bench>
      </Specimen>
    </Section>
  );
};
