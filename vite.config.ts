import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: {
  env: Record<string, string | undefined>
}

declare function fetch(
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
): Promise<{
  ok: boolean
  statusText: string
  text: () => Promise<string>
  json: () => Promise<unknown>
}>

export default defineConfig({
  plugins: [react(), changePointApiPlugin()],
})

function changePointApiPlugin() {
  return {
    name: 'change-point-api',
    configureServer(server) {
      ;(server.middlewares.use as PathAwareMiddlewareUse)(
        '/api/change-points',
        createChangePointHandler(),
      )
    },
    configurePreviewServer(server) {
      ;(server.middlewares.use as PathAwareMiddlewareUse)(
        '/api/change-points',
        createChangePointHandler(),
      )
    },
  } satisfies Plugin
}

type ChangePointHandler = (
  req: {
    method?: string
    on: (event: 'data' | 'end' | 'error', listener: (...args: any[]) => void) => void
  },
  res: {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: (chunk?: string) => void
  },
) => void

type PathAwareMiddlewareUse = (path: string, handler: ChangePointHandler) => void

type ChangePointEntry = {
  date: string
  wish: string
  wonderAt: string
  wonderAbout: string
}

type ChangePointRequestBody = {
  entries?: ChangePointEntry[]
  maxCount?: number
}

type OpenAIResponseBody = {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      refusal?: string
    }>
  }>
}

function createChangePointHandler(): ChangePointHandler {
  return async (req, res) => {
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'Method not allowed.' })
      return
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      writeJson(res, 503, {
        error: 'OPENAI_API_KEY が未設定です。変化点年表はまだ利用できません。',
      })
      return
    }

    try {
      const payload = await readJsonBody<ChangePointRequestBody>(req)
      const entries = payload.entries ?? []
      const maxCount = normalizeMaxCount(payload.maxCount)

      if (entries.length === 0) {
        writeJson(res, 200, { changePoints: [] })
        return
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-5-mini',
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    `You are editing a Japanese personal chronology. Read the entries and extract up to ${maxCount} change points. Each change point must be grounded in the entries, concise, and written in Japanese. Each point must have a short retrospective title only. Do not invent facts. Return only the structured result.`,
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify({ entries }),
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'change_points',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  changePoints: {
                    type: 'array',
                    maxItems: maxCount,
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        title: { type: 'string' },
                      },
                      required: ['date', 'title'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['changePoints'],
                additionalProperties: false,
              },
            },
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        writeJson(res, 502, {
          error: `OpenAI API request failed: ${errorText || response.statusText}`,
        })
        return
      }

      const responseBody = (await response.json()) as OpenAIResponseBody
      const refusal = extractRefusal(responseBody)
      if (refusal) {
        writeJson(res, 502, { error: `OpenAI request was refused: ${refusal}` })
        return
      }

      const outputText = extractStructuredOutputText(responseBody)
      if (!outputText) {
        writeJson(res, 502, {
          error:
            'OpenAI response did not include structured output. The response shape was not recognized.',
        })
        return
      }

      const parsed = JSON.parse(outputText) as {
        changePoints?: Array<{ date: string; title: string }>
      }

      writeJson(res, 200, { changePoints: parsed.changePoints ?? [] })
    } catch (error) {
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unexpected server error.',
      })
    }
  }
}

function readJsonBody<T>(req: {
  on: (event: 'data' | 'end' | 'error', listener: (...args: any[]) => void) => void
}): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = ''

    req.on('data', (chunk) => {
      raw += String(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}') as T)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function writeJson(
  res: {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: (chunk?: string) => void
  },
  statusCode: number,
  body: unknown,
) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function extractStructuredOutputText(responseBody: OpenAIResponseBody): string | undefined {
  if (responseBody.output_text) {
    return responseBody.output_text
  }

  for (const item of responseBody.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        (content.type === 'output_text' || content.type === 'text') &&
        typeof content.text === 'string'
      ) {
        return content.text
      }
    }
  }

  return undefined
}

function extractRefusal(responseBody: OpenAIResponseBody): string | undefined {
  for (const item of responseBody.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.refusal === 'string' && content.refusal.length > 0) {
        return content.refusal
      }
    }
  }

  return undefined
}

function normalizeMaxCount(value: number | undefined): number {
  return value === 3 || value === 10 ? value : 5
}
