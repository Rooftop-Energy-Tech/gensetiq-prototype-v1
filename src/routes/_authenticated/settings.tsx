import {createFileRoute} from '@tanstack/react-router';
import {SettingsIcon} from 'lucide-react';

import {ComingSoon} from '@/components/global/ComingSoon';
import {BRAND_PICKER_VISIBLE, SettingsPage} from '@/modules/settings';

/**
 * Settings — the brand picker where there is one, the old placeholder where there
 * is not.
 *
 * A deployed customer build hides the picker (see `modules/settings/index.tsx` for
 * why), and on that build this screen has nothing else to show yet, so it falls
 * back to the promise it was already making. The account, fleet and alerting
 * preferences it names still have no data behind them.
 */
export const Route = createFileRoute('/_authenticated/settings')({
  staticData: {crumb: 'Settings'},
  component: () =>
    BRAND_PICKER_VISIBLE ? (
      <SettingsPage />
    ) : (
      <ComingSoon
        icon={SettingsIcon}
        title="Settings"
        description="Account, fleet and alerting preferences. Not designed yet."
      />
    ),
});
