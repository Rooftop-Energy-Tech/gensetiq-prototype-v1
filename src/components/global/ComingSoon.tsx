import type {LucideIcon} from 'lucide-react';

/**
 * Placeholder for the three sidebar destinations the Figma file names but does
 * not design. They exist as real routes so the nav isn't a set of dead buttons —
 * a reviewer clicking "Sites" should land somewhere that says what it will be,
 * not nowhere.
 */
export const ComingSoon = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
    <div className="flex size-12 items-center justify-center rounded-lg border border-subtle bg-element">
      <Icon className="size-5 text-secondary" aria-hidden="true" />
    </div>
    <div className="flex max-w-sm flex-col gap-1">
      <h1 className="text-base font-medium text-primary">{title}</h1>
      <p className="text-sm text-secondary">{description}</p>
    </div>
  </div>
);
