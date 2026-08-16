import {Link} from '@tanstack/react-router';
import {cva} from 'class-variance-authority';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/lib/utils';

export type NavItem = {
  label: string;
  icon: LucideIcon;
  /**
   * A static route path, as a literal union rather than `string`.
   *
   * With a bare `string` here, `Link` cannot resolve its generics and the render
   * prop below loses its type — `isActive` comes through as `any`. It only became
   * an error once the route tree grew parameterised paths (`/gensets/$gensetId`),
   * because until then the fallback happened to land on something usable.
   */
  link: '/gensets' | '/deployment' | '/sites' | '/meters' | '/refuel' | '/settings';
};

/**
 * 78px wide with 12px of vertical padding, per the design — wider and shorter
 * than the 64px square RooftopIQ uses, because "Deployment" has to fit on one
 * line at 12px.
 */
const navButtonVariants = cva(
  'relative flex w-[78px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border px-1 py-3 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-outline/40',
  {
    variants: {
      active: {
        true: 'border-strong bg-sidebar-highlight text-sidebar-primary',
        false:
          'border-transparent text-sidebar-secondary hover:bg-sidebar-highlight hover:text-sidebar-primary',
      },
    },
    defaultVariants: {active: false},
  },
);

export const NavButton = ({item, className}: {item: NavItem; className?: string}) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.link}
      // `activeProps` would only give us a class, but the active styling here is
      // a whole cva branch — so read the match state from the render prop.
      activeOptions={{exact: false}}
      className={cn(className)}
    >
      {({isActive}) => (
        <span className={navButtonVariants({active: isActive})}>
          <Icon className="size-5" aria-hidden="true" />
          {item.label}
        </span>
      )}
    </Link>
  );
};
