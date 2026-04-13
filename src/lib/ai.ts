import type { ChangePoint, JournalEntry } from '../types'

type ChangePointApiResponse = {
  changePoints: Array<{
    date: string
    text: string
  }>
}

type ChangePointApiError = {
  error?: string
}

export async function generateChangePoints(entries: JournalEntry[]): Promise<ChangePoint[]> {
  const response = await fetch('/api/change-points', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entries }),
  })

  if (!response.ok) {
    const errorBody = (await safeParseJson<ChangePointApiError>(response)) ?? {}
    throw new Error(errorBody.error ?? '変化点の生成に失敗しました。')
  }

  const body = await safeParseJson<ChangePointApiResponse>(response)
  const changePoints = body?.changePoints ?? []

  return changePoints.map((point, index) => ({
    id: `${point.date}-${index}`,
    date: point.date,
    text: point.text,
  }))
}

export function toChangePointColumns(changePoints: ChangePoint[]) {
  return changePoints.map((point) => ({
    id: point.id,
    periodId: point.id,
    granularity: 'change-point' as const,
    kind: 'change-point' as const,
    periodLabel: point.date,
    summaryTitle: '変化点',
    wishText: '',
    wonderAtText: '',
    wonderAboutText: point.text,
    hasPhoto: false,
    entryCount: 1,
  }))
}

async function safeParseJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T
  } catch {
    return undefined
  }
}
