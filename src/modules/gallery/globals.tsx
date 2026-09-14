import {RadioTowerIcon} from 'lucide-react';
import {useState} from 'react';

import {AlarmBadge, AlarmCounts} from '@/components/global/AlarmCounts';
import {AlarmPill} from '@/components/global/AlarmPill';
import {BatteryGlyph} from '@/components/global/BatteryGlyph';
import {ChartTooltip} from '@/components/global/ChartTooltip';
import {ComingSoon} from '@/components/global/ComingSoon';
import {DetailBand} from '@/components/global/DetailBand';
import {FilterSelect} from '@/components/global/FilterSelect';
import {MetricStrip} from '@/components/global/MetricStrip';
import {NotFound} from '@/components/global/NotFound';
import {PreviewPanel, PreviewRow} from '@/components/global/PreviewPanel';
import {
  CardNote,
  CountChip,
  FilterCard,
  Headline,
  SummaryCard,
  SummaryCardRow,
  SummaryCollapseButton,
} from '@/components/global/SummaryCards';
import {TankGlyph} from '@/components/global/TankGlyph';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {RunStateBadge} from '@/modules/genset/components/RunStateBadge';
import {MetricRow} from '@/modules/genset/components/detail/MetricRow';
import {ALERT_SEVERITIES} from '@/modules/genset/types/alert.type';
import type {AlertSeverity} from '@/modules/genset/types/alert.type';
import {UNHANDLED} from '@/modules/genset/types/alarmState.type';
import type {AlarmView} from '@/modules/genset/types/alarmView.type';
import {RUN_STATES} from '@/modules/genset/types/genset.type';
import {Bench, Section, Specimen, Variant} from '@/modules/gallery/frame';

/**
 * `src/components/global` — the shared tier, plus the two genset atoms
 * (`RunStateBadge`, `MetricRow`) that everything else composes out of.
 *
 * The 100-odd components under `src/modules/*` are deliberately **not** here.
 * They are page-shaped — a register, a detail shell, a rack — and the app already
 * renders every one of them against real fixture data at a real URL, which is a
 * better bench than anything this file could stage. What a gallery adds is the
 * states a running app will not show you at once: a glyph at every charge level,
 * a pill at every severity, a card in both its active and inactive state. That is
 * what this tier is, and that is where the bench earns its keep.
 */

/** Every link on this page comes back here. A gallery navigates nowhere. */
const HERE = '/gallery' as const;

const alarmView = (severity: AlertSeverity, name: string): AlarmView => ({
  id: `gallery-${severity.toLowerCase()}`,
  name,
  provenance: 'Huawei SMU02C · 0x5009',
  className: 'Alarm',
  severity,
  raisedAt: '2026-09-12T04:18:00+08:00',
  handling: UNHANDLED,
});

const COUNTS: Record<string, Record<AlertSeverity, number>> = {
  clear: {CRITICAL: 0, WARNING: 0, NEUTRAL: 0},
  warning: {CRITICAL: 0, WARNING: 2, NEUTRAL: 1},
  critical: {CRITICAL: 3, WARNING: 1, NEUTRAL: 0},
};

const CHARGE_LEVELS = [1, 0.62, 0.38, 0.24, 0.04] as const;

type Region = 'sarawak' | 'sabah' | 'johor';

export const GlobalsSection = () => {
  const [region, setRegion] = useState<Region | undefined>('sarawak');
  const [lowFuel, setLowFuel] = useState(true);
  const [offline, setOffline] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Section
      id="globals"
      title="Shared components"
      blurb="src/components/global — the pieces more than one module draws. Every state at once, which is the one thing browsing the real routes cannot give you."
    >
      <Specimen
        name="AlarmCounts · AlarmBadge"
        source="@/components/global/AlarmCounts"
        note="Critical · Warning · Neutral, in fixed 20px cells so the pill does not resize as counts cross into double figures. A standing severity fills its cell rather than only changing its digit."
      >
        <Bench>
          {Object.entries(COUNTS).map(([key, counts]) => (
            <Variant key={key} label={`AlarmBadge — ${key}`}>
              <AlarmBadge counts={counts} to={HERE} />
            </Variant>
          ))}
          <Variant label="AlarmCounts — raw, inside your own Badge">
            <Badge variant="secondary" className="h-6 gap-0 border-0 px-0 py-0">
              <AlarmCounts counts={COUNTS.critical} />
            </Badge>
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="AlarmPill"
        source="@/components/global/AlarmPill"
        note="Rank first, then the register name — the opposite order to BayAlarms, deliberately: a pill is read at a glance among non-alarm chips, a list is scanned by name."
      >
        <Bench>
          {ALERT_SEVERITIES.map((severity) => (
            <Variant key={severity} label={`severity="${severity}"`}>
              <AlarmPill fault={alarmView(severity, 'SSU 4 Fault')} to={HERE} />
            </Variant>
          ))}
          <Variant label="wrap — for the narrow part cards" className="w-[150px]">
            <AlarmPill
              fault={alarmView('CRITICAL', 'PV 1 Array Fault')}
              to={HERE}
              wrap
            />
          </Variant>
          <Variant label="truncating — the panels' default" className="w-[150px]">
            <AlarmPill fault={alarmView('CRITICAL', 'PV 1 Array Fault')} to={HERE} />
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="BatteryGlyph"
        source="@/components/global/BatteryGlyph"
        note="Colour is derived from the fraction, not passed in — amber under 40%, red under 30%. The bar is a width in percent so a reader can check it against the figure beside it."
      >
        <Bench>
          {CHARGE_LEVELS.map((fraction) => (
            <Variant key={fraction} label={`fraction={${fraction}}`}>
              <BatteryGlyph fraction={fraction} />
            </Variant>
          ))}
        </Bench>
        <Bench>
          <Variant label='size="xl"'>
            <BatteryGlyph fraction={0.72} size="xl" />
          </Variant>
          <Variant label='size="lg" (default)'>
            <BatteryGlyph fraction={0.72} size="lg" />
          </Variant>
          <Variant label='size="sm"'>
            <BatteryGlyph fraction={0.72} size="sm" />
          </Variant>
          <Variant label="charging — xl">
            <BatteryGlyph fraction={0.55} size="xl" charging />
          </Variant>
          <Variant label="charging — low">
            <BatteryGlyph fraction={0.22} size="lg" charging />
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="TankGlyph"
        source="@/components/global/TankGlyph"
        note="Segmented rather than continuous: eight bars at lg, six at sm. The topmost filled bar takes the meniscus token."
      >
        <Bench>
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <Variant key={fraction} label={`fraction={${fraction}}`}>
              <TankGlyph fraction={fraction} tone="fuel" />
            </Variant>
          ))}
          <Variant label='size="sm"'>
            <TankGlyph fraction={0.5} tone="fuel" size="sm" />
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="RunStateBadge"
        source="@/modules/genset/components/RunStateBadge"
        note="A genset atom rather than a global, but it sits beside AlarmBadge everywhere in the app, so it is worth seeing them on one bench."
      >
        <Bench>
          {RUN_STATES.map((runState) => (
            <Variant key={runState} label={`runState="${runState}"`}>
              <RunStateBadge runState={runState} />
            </Variant>
          ))}
        </Bench>
      </Specimen>

      <Specimen
        name="MetricStrip"
        source="@/components/global/MetricStrip"
        note="Column layout below @2xl, row above — a container query, so it reflows against its own width rather than the viewport's. Drag the browser narrow to see it."
      >
        <Bench wide>
          <MetricStrip
            ariaLabel="Site summary"
            metrics={[
              {label: 'Load', value: '18.4 kW'},
              {label: 'Solar', value: '6.2 kW'},
              {label: 'Battery', value: '82%'},
            ]}
            counts={COUNTS.critical}
            alarmLink={{to: HERE}}
            trailing={{label: 'Fuel', value: '61%'}}
          />
          <MetricStrip
            ariaLabel="Site summary, no trailing"
            metrics={[
              {label: 'Load', value: '11.0 kW'},
              {label: 'Rectifiers', value: '4 of 4'},
            ]}
            counts={COUNTS.clear}
            alarmLink={{to: HERE}}
          />
        </Bench>
      </Specimen>

      <Specimen
        name="SummaryCards"
        source="@/components/global/SummaryCards"
        note="A family, not one component: SummaryCardRow lays out the grid and caps the first three columns at 13rem so a long tail of filter cards does not stretch the headline ones."
      >
        <Bench wide>
          <SummaryCardRow id="gallery-summary" collapsed={collapsed}>
            <SummaryCard label="Sites">
              <Headline value={38} unit="sites" detail="Across 4 regions" />
              <CardNote>2 commissioned this month</CardNote>
            </SummaryCard>
            <SummaryCard label="Availability">
              <Headline value="99.2" unit="%" detail="Rolling 30 days" />
            </SummaryCard>
            <FilterCard
              label="Low fuel"
              count={6}
              unit="sites"
              detail="Below the 25% reserve line"
              tone="fuel-low"
              active={lowFuel}
              onToggle={setLowFuel}
            />
            <FilterCard
              label="Offline"
              count={2}
              unit="sites"
              detail="No telemetry for over an hour"
              tone="critical"
              active={offline}
              onToggle={setOffline}
            />
          </SummaryCardRow>
          <Variant label="SummaryCollapseButton — md:hidden, so only below 768px">
            <SummaryCollapseButton
              collapsed={collapsed}
              onCollapsedChange={setCollapsed}
              activeCount={[lowFuel, offline].filter(Boolean).length}
              controls="gallery-summary"
            />
          </Variant>
          <Variant label="CountChip — every tone">
            <div className="flex flex-wrap gap-2">
              <CountChip label="Running" count={24} tone="ok" active onToggle={() => {}} />
              <CountChip label="Idle" count={9} tone="neutral" active={false} onToggle={() => {}} />
              <CountChip label="Attention" count={4} tone="warning" active={false} onToggle={() => {}} />
              <CountChip label="Critical" count={2} tone="critical" active={false} onToggle={() => {}} />
              <CountChip label="Fuel" count={7} tone="fuel" active={false} onToggle={() => {}} />
              <CountChip label="Low fuel" count={3} tone="fuel-low" active={false} onToggle={() => {}} />
            </div>
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="FilterSelect"
        source="@/components/global/FilterSelect"
        note="The selected value replaces the dimension's name rather than sitting after it — `Sarawak` says as much as `Region: Sarawak` in half the width. Returns null on an empty options array."
      >
        <Bench>
          <Variant label="value set">
            <FilterSelect<Region>
              label="Region"
              allLabel="All regions"
              value={region}
              onChange={setRegion}
              options={[
                {key: 'sarawak', label: 'Sarawak', count: 18, tone: 'ok'},
                {key: 'sabah', label: 'Sabah', count: 12, tone: 'warning'},
                {key: 'johor', label: 'Johor', count: 8, tone: 'critical'},
              ]}
            />
          </Variant>
          <Variant label="value undefined — unselected">
            <FilterSelect<Region>
              label="Region"
              allLabel="All regions"
              value={undefined}
              onChange={() => {}}
              options={[
                {key: 'sarawak', label: 'Sarawak', count: 18},
                {key: 'sabah', label: 'Sabah', count: 12},
              ]}
            />
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="DetailBand · MetricRow"
        source="@/components/global/DetailBand"
        note="Splits its rows into two balanced columns above @2xl and stacks them below. MetricRow is the row itself, also used on its own inside the detail panels."
      >
        <Bench wide>
          <DetailBand
            ariaLabel="Genset details"
            rows={[
              {label: 'Model', value: 'Cummins C220 D5'},
              {label: 'Serial', value: 'BRF9540'},
              {label: 'Rating', value: '220 kVA'},
              {label: 'Commissioned', value: '14 Mar 2024'},
              {label: 'Controller', value: 'DSE 7320 MKII'},
              {label: 'Hour meter', value: '4,182 h'},
            ]}
          />
          <Variant label="MetricRow on its own" className="w-full max-w-sm">
            <div className="flex w-full flex-col gap-2.5">
              <MetricRow label="Coolant temperature" value="84.2 °C" />
              <MetricRow label="A very long reading label that has to truncate" value="24.1 V" />
            </div>
          </Variant>
        </Bench>
      </Specimen>

      <Specimen
        name="PreviewPanel"
        source="@/components/global/PreviewPanel"
        note="The register screens' right-hand panel. Renders its empty message when heading is undefined, which is the state it is in before a row is clicked."
      >
        <Bench wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <Variant label="with a selection" className="w-full">
              <PreviewPanel
                label="Site preview"
                heading="Batu Lintang BTS"
                emptyMessage="Select a site"
                className="h-56 w-full"
                action={
                  <Button variant="ghost" size="xs">
                    Open
                  </Button>
                }
              >
                <PreviewRow label="Region">Sarawak</PreviewRow>
                <PreviewRow label="Load">18.4 kW</PreviewRow>
                <PreviewRow label="Alarms">
                  <AlarmBadge counts={COUNTS.warning} to={HERE} />
                </PreviewRow>
                <PreviewRow label="Genset">Cummins C220 D5</PreviewRow>
              </PreviewPanel>
            </Variant>
            <Variant label="heading={undefined} — empty" className="w-full">
              <PreviewPanel
                label="Site preview, empty"
                heading={undefined}
                emptyMessage="Select a site to see its details"
                className="h-56 w-full"
              />
            </Variant>
          </div>
        </Bench>
      </Specimen>

      <Specimen
        name="ChartTooltip"
        source="@/components/global/ChartTooltip"
        note="Absolutely positioned inside a chart frame, and flips to the left of the cursor when it would overflow frameWidth. Both sides are shown here against one 520px frame."
      >
        <Bench wide>
          <div className="relative h-40 w-full max-w-[520px] rounded-md border border-dashed border-default">
            <ChartTooltip
              x={40}
              frameWidth={520}
              title="12:45"
              rows={[
                {key: 'load', label: 'Load', value: '18.4 kW', swatch: 'line'},
                {key: 'solar', label: 'Solar', value: '6.2 kW', swatch: 'dashed'},
                {key: 'batt', label: 'Battery', value: '−3.1 kW', swatch: 'square'},
              ]}
              note="Right of the cursor"
            />
            <ChartTooltip
              x={500}
              frameWidth={520}
              top={92}
              title="Flipped"
              rows={[{key: 'one', value: '61%', swatch: 'dot'}]}
              note="Would overflow, so it flips"
            />
          </div>
        </Bench>
      </Specimen>

      <Specimen
        name="ComingSoon · NotFound"
        source="@/components/global/ComingSoon, NotFound"
        note="The two full-page placeholders. Both expect flex-1 in a column, so they are boxed at a fixed height here rather than filling the gallery."
      >
        <Bench wide>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex h-52 rounded-md border border-dashed border-default">
              <ComingSoon
                title="Telco sites"
                description="The tower register is not in this prototype yet."
                icon={RadioTowerIcon}
              />
            </div>
            <div className="flex h-52 rounded-md border border-dashed border-default">
              <NotFound />
            </div>
          </div>
        </Bench>
      </Specimen>
    </Section>
  );
};
