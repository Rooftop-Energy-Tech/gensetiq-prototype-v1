import {HistoryIcon, WarehouseIcon} from 'lucide-react';

import {DetailSidebar, DetailSidebarLabel} from '@/components/global/DetailSidebar';
import type {DetailNavEntry} from '@/components/global/DetailSidebar';
import {DEPOTS} from './data/depotTank';

/**
 * The Fuel rail from `md` up: the shared `DetailSidebar`, drawn as the Service
 * rail is — a `Fuel` label, then rows with icons (Jeff, 2026-10-05). It was a rail
 * of its own until then, with an uppercase `Depots` heading and a red or amber dot
 * on the heading and on each depot; the dots came off with the move, and the
 * verdicts stay on the depot cards and the phone's `ViewSwitch`.
 *
 * - **Depot tanks** — `/fuel`, the default tab. Its depots are sub-rows under it,
 *   each a link to that depot's own page; its chevron folds them away.
 * - **History** — `/fuel?view=history`, every genset fill (`Genset fills` until
 *   2026-10-05).
 *
 * Links throughout, matched by the router. The two tabs share one path, so each
 * matches its query string too (`matchSearch`), as Service's `Due` and `History`
 * do; *Depot tanks* also matches its path exactly (`end`), so it stays dark on a
 * depot's page, where only that depot's row is lit. The route turns a stray
 * `?view=depots` into a bare `/fuel`, which is what *Depot tanks* matches.
 *
 * Hidden below `md`, as every `DetailSidebar` is; phones get `ViewSwitch`'s cards.
 */
const FUEL_NAV: Array<DetailNavEntry> = [
  {
    label: 'Depot tanks',
    icon: WarehouseIcon,
    link: {to: '/fuel', search: {}, end: true, matchSearch: true},
    items: DEPOTS.map((depot) => ({
      label: depot.name,
      to: '/fuel/depots/$depotId',
      params: {depotId: depot.id},
    })),
  },
  {label: 'History', icon: HistoryIcon, to: '/fuel', search: {view: 'history'}, matchSearch: true},
];

export const FuelNav = () => (
  <DetailSidebar ariaLabel="Fuel sections" header={<DetailSidebarLabel>Fuel</DetailSidebarLabel>} entries={FUEL_NAV} />
);
