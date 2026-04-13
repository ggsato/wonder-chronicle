import type {
  AggregatedPeriod,
  DirectionMode,
  Granularity,
  JournalEntry,
  TimelineColumnViewModel,
} from '../types'
import {
  endOfMonth,
  endOfWeek,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  startOfMonth,
  startOfWeek,
  todayInTokyo,
} from './date'

type AnchorKind = 'today' | 'latest' | 'earliest'

export function normalizeEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date))
}

export function aggregateEntries(
  entries: JournalEntry[],
  granularity: Granularity,
): AggregatedPeriod[] {
  if (granularity === 'day') {
    return entries.map((entry) => ({
      id: `day:${entry.date}`,
      granularity,
      startDate: entry.date,
      endDate: entry.date,
      periodLabel: formatDayLabel(entry.date),
      representativeWish: entry.wish,
      representativeWonderAt: entry.wonderAt,
      representativeWonderAbout: entry.wonderAbout,
      representativePhoto: entry.photos[0],
      entryIds: [entry.id],
    }))
  }

  const groups = new Map<string, JournalEntry[]>()

  for (const entry of entries) {
    const key =
      granularity === 'week' ? startOfWeek(entry.date) : startOfMonth(entry.date)
    const existing = groups.get(key) ?? []
    existing.push(entry)
    groups.set(key, existing)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, periodEntries]) => {
      const firstEntry = periodEntries[0]
      const photoCarrier = periodEntries.find((entry) => entry.photos.length > 0)
      const startDate = key
      const endDate = granularity === 'week' ? endOfWeek(key) : endOfMonth(key)

      return {
        id: `${granularity}:${key}`,
        granularity,
        startDate,
        endDate,
        periodLabel:
          granularity === 'week'
            ? formatWeekLabel(startDate, endDate)
            : formatMonthLabel(key),
        summaryTitle:
          granularity === 'month'
            ? truncate(firstEntry.wonderAt, 22)
            : undefined,
        representativeWish: firstEntry.wish,
        representativeWonderAt: firstEntry.wonderAt,
        representativeWonderAbout: firstEntry.wonderAbout,
        representativePhoto: photoCarrier?.photos[0],
        entryIds: periodEntries.map((entry) => entry.id),
      }
    })
}

export function toColumnViewModels(
  periods: AggregatedPeriod[],
): TimelineColumnViewModel[] {
  return periods.map((period) => ({
    id: period.id,
    periodId: period.id,
    granularity: period.granularity,
    kind: 'period',
    periodLabel: period.periodLabel,
    summaryTitle: period.summaryTitle,
    wishText: truncate(period.representativeWish, period.granularity === 'day' ? 72 : 88),
    wonderAtText: truncate(
      period.representativeWonderAt,
      period.granularity === 'day' ? 72 : 88,
    ),
    wonderAboutText: truncate(
      period.representativeWonderAbout,
      period.granularity === 'day' ? 88 : 104,
    ),
    photo: period.representativePhoto
      ? {
          url: period.representativePhoto.url,
          alt: `${period.periodLabel} の代表写真`,
        }
      : undefined,
    hasPhoto: Boolean(period.representativePhoto),
    entryCount: period.entryIds.length,
  }))
}

export function toRenderedColumns(
  columns: TimelineColumnViewModel[],
  directionMode: DirectionMode,
): TimelineColumnViewModel[] {
  return directionMode === 'past-right' ? [...columns].reverse() : columns
}

export function resolveAnchorPeriodId(
  periods: AggregatedPeriod[],
  granularity: Granularity,
  anchor: AnchorKind,
): string | undefined {
  if (periods.length === 0) {
    return undefined
  }

  if (anchor === 'earliest') {
    return periods[0]?.id
  }

  if (anchor === 'latest') {
    return periods[periods.length - 1]?.id
  }

  const today = todayInTokyo()
  const targetPeriod = periods.find((period) => periodContains(period, today))

  if (targetPeriod) {
    return targetPeriod.id
  }

  const priorPeriods = periods.filter((period) => period.startDate <= today)
  if (priorPeriods.length > 0) {
    return priorPeriods[priorPeriods.length - 1]?.id
  }

  return resolveAnchorPeriodId(periods, granularity, 'earliest')
}

export function getPeriodIndexById(
  periods: AggregatedPeriod[],
  periodId?: string,
): number {
  if (!periodId) {
    return -1
  }
  return periods.findIndex((period) => period.id === periodId)
}

export function periodContains(period: AggregatedPeriod, date: string): boolean {
  return period.startDate <= date && date <= period.endDate
}

function truncate(text: string, length: number): string {
  if (text.length <= length) {
    return text
  }
  return `${text.slice(0, length).trimEnd()}…`
}
