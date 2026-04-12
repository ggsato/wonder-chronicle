import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { todayInTokyo } from '../lib/date'
import type { EntryPhoto, JournalEntry } from '../types'

type EntryFormProps = {
  initialDate: string
  existingEntry?: JournalEntry
  onSave: (entry: JournalEntry) => void
  onCancel: () => void
}

export function EntryForm({
  initialDate,
  existingEntry,
  onSave,
  onCancel,
}: EntryFormProps) {
  const [date, setDate] = useState(initialDate)
  const [wish, setWish] = useState(existingEntry?.wish ?? '')
  const [wonderAt, setWonderAt] = useState(existingEntry?.wonderAt ?? '')
  const [wonderAbout, setWonderAbout] = useState(existingEntry?.wonderAbout ?? '')
  const [photos, setPhotos] = useState<EntryPhoto[]>(existingEntry?.photos ?? [])
  const pendingObjectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    setDate(initialDate)
    setWish(existingEntry?.wish ?? '')
    setWonderAt(existingEntry?.wonderAt ?? '')
    setWonderAbout(existingEntry?.wonderAbout ?? '')
    setPhotos(existingEntry?.photos ?? [])

    for (const url of pendingObjectUrlsRef.current) {
      URL.revokeObjectURL(url)
    }
    pendingObjectUrlsRef.current = []
  }, [existingEntry, initialDate])

  useEffect(() => {
    return () => {
      for (const url of pendingObjectUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3)
    for (const url of pendingObjectUrlsRef.current) {
      URL.revokeObjectURL(url)
    }
    const nextPhotos = files.map((file, index) => ({
      id: `${date}-upload-${index}-${file.name}`,
      kind: 'local-object-url' as const,
      url: URL.createObjectURL(file),
    }))
    pendingObjectUrlsRef.current = nextPhotos.map((photo) => photo.url)
    setPhotos(nextPhotos)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    pendingObjectUrlsRef.current = []
    onSave({
      id: existingEntry?.id ?? date,
      date,
      wish: wish.trim(),
      wonderAt: wonderAt.trim(),
      wonderAbout: wonderAbout.trim(),
      photos,
    })
  }

  return (
    <div className="overlay">
      <div className="panel panel--form">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Entry Form</p>
            <h2>{existingEntry ? '同日の記録を更新' : '記録する'}</h2>
          </div>
          <button className="panel__close" onClick={onCancel} type="button">
            閉じる
          </button>
        </div>

        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            日付
            <input
              max={todayInTokyo()}
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>

          <label>
            Wish
            <textarea
              onChange={(event) => setWish(event.target.value)}
              required
              rows={3}
              value={wish}
            />
          </label>

          <label>
            Wonder at
            <textarea
              onChange={(event) => setWonderAt(event.target.value)}
              required
              rows={3}
              value={wonderAt}
            />
          </label>

          <label>
            Wonder about
            <textarea
              onChange={(event) => setWonderAbout(event.target.value)}
              required
              rows={4}
              value={wonderAbout}
            />
          </label>

          <label>
            写真
            <input accept="image/*" multiple onChange={handlePhotos} type="file" />
          </label>

          <div className="photo-strip">
            {photos.length > 0 ? (
              photos.map((photo) => (
                <img key={photo.id} alt="" className="photo-strip__item" src={photo.url} />
              ))
            ) : (
              <span className="photo-strip__empty">写真は最大3枚まで</span>
            )}
          </div>

          <div className="entry-form__actions">
            <button className="ghost-button" onClick={onCancel} type="button">
              キャンセル
            </button>
            <button className="primary-button" type="submit">
              保存する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
