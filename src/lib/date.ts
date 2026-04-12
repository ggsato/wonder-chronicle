const TOKYO_LOCALE = 'en-CA'
const TOKYO_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function todayInTokyo(): string {
  return new Intl.DateTimeFormat(TOKYO_LOCALE, {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function parseDateOnly(input: string): Date {
  return new Date(`${input}T12:00:00+09:00`)
}

export function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat(TOKYO_LOCALE, {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDays(dateString: string, amount: number): string {
  const base = parseDateOnly(dateString)
  base.setUTCDate(base.getUTCDate() + amount)
  return formatDateOnly(base)
}

export function startOfWeek(dateString: string): string {
  const date = parseDateOnly(dateString)
  const day = date.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return formatDateOnly(date)
}

export function endOfWeek(dateString: string): string {
  return addDays(startOfWeek(dateString), 6)
}

export function startOfMonth(dateString: string): string {
  return `${dateString.slice(0, 7)}-01`
}

export function endOfMonth(dateString: string): string {
  const date = parseDateOnly(startOfMonth(dateString))
  date.setUTCMonth(date.getUTCMonth() + 1)
  date.setUTCDate(0)
  return formatDateOnly(date)
}

export function formatWeekLabel(startDate: string, endDate: string): string {
  return `${startDate.slice(5).replace('-', '/')} - ${endDate.slice(5).replace('-', '/')}`
}

export function formatMonthLabel(dateString: string): string {
  const [year, month] = dateString.split('-')
  return `${year}年${Number(month)}月`
}

export function formatDayLabel(dateString: string): string {
  const date = parseDateOnly(dateString)
  const weekday = TOKYO_WEEKDAYS[date.getUTCDay()]
  return `${dateString.replace(/-/g, '.')} ${weekday}`
}
