import {Link} from '@tanstack/react-router';
import {ArrowRightIcon, BatteryChargingIcon} from 'lucide-react';

import {PreviewPanel, PreviewRow} from '@/components/global/PreviewPanel';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {amount} from '@/lib/format';
import {cn} from '@/lib/utils';
import {SITE_POWER_ROLE_LABEL} from '@/modules/site/types/site.type';
import {BANK_RUNTIME_META, bankRuntime} from '../runtimeMeta';
import {BANK_FLOW_LABEL, bankFlow, bankName} from '../../types/bank.type';
import type {BatteryBank} from '../../types/bank.type';

/**
 * The preview beside the bank register — what a selected bank is, in five facts.
 *
 * ## Why these five
 *
 * The panel is a *preview*, so the test for a row is whether it changes what a reader
 * does next. Charge, runtime and flow are the three that move through the day;
 * autonomy is the specification the runtime is read against, and health is how much
 * of that specification is still in the cabinet. Capacity is left to the table and to
 * the bank's own header, where it is half the name.
 *
 * The two percentages are two rows apart rather than adjacent, which is the rule the
 * register's columns follow: `81%` health read as a worse `81%` charge is the
 * expensive misreading, and the hours between them are what break the pairing.
 */
export const BankPreviewPanel = ({
  bank,
  className,
}: {
  bank: BatteryBank | undefined;
  className?: string;
}) => {
  if (bank === undefined) {
    return (
      <PreviewPanel
        label="Battery bank details"
        heading={undefined}
        emptyMessage="Select a bank to see its details."
        className={className}
      />
    );
  }

  const flow = bankFlow(bank);
  const runtime = BANK_RUNTIME_META[bankRuntime(bank)];

  return (
    <PreviewPanel
      label="Battery bank details"
      heading={bankName(bank)}
      emptyMessage="Select a bank to see its details."
      className={className}
      action={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" asChild>
              <Link
                to="/battery/$bankId"
                params={{bankId: bank.id}}
                aria-label={`Open ${bank.siteName}`}
              >
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Open bank</TooltipContent>
        </Tooltip>
      }
    >
      <PreviewRow label="Charge">{Math.round(bank.soc * 100)}%</PreviewRow>
      <PreviewRow label="Runtime left">
        {/* The dot is the map's own scale, so the pin the reader just clicked and this
            line are one reading. */}
        <span className="flex items-center gap-1.5">
          <span
            className={cn('size-1.5 shrink-0 rounded-full', runtime.dotClassName)}
            aria-hidden="true"
          />
          {amount(bank.hoursLeft, 'h', 1)}
          <span className="truncate text-secondary">of {amount(bank.autonomyHours, 'h')}</span>
        </span>
      </PreviewRow>
      <PreviewRow label="Flow">
        <Badge variant="secondary" className="whitespace-pre">
          <BatteryChargingIcon
            className={flow === 'IDLE' ? 'text-tertiary' : 'text-battery'}
            aria-hidden="true"
          />
          {BANK_FLOW_LABEL[flow]}
          {flow !== 'IDLE' && (
            <>
              <span className="text-secondary"> | </span>
              {amount(Math.abs(bank.powerKw), 'kW')}
            </>
          )}
        </Badge>
      </PreviewRow>
      <PreviewRow label="Health">{Math.round(bank.soh * 100)}%</PreviewRow>
      <PreviewRow label="Configuration">{SITE_POWER_ROLE_LABEL[bank.role]}</PreviewRow>
    </PreviewPanel>
  );
};
