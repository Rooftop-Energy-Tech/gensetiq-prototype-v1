import type {LucideIcon} from 'lucide-react';

/**
 * Placeholder for destinations that exist but are not designed yet — Settings and a
 * genset's Settings and Equipment tabs. They are real routes so the nav isn't a set
 * of dead buttons: a reviewer clicking one lands somewhere that says what it will
 * be, not nowhere.
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
