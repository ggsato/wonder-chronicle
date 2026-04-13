# Wonder Chronicle AI Change-Point Timeline Decision Log

## Spec Delta

- 変更点:
  AI機能の初回実装対象を、既存の day / week / month 年表に埋め込む期間要約ではなく、**変化点年表** という別ビューに切り替えた。既存年表はナビゲーション用途として維持し、AIは記録群から「何が変わったか」を抽出する編集レイヤーとして扱う。
- 理由:
  月表示の見出し要約を強化しても「その月の雰囲気」は見えやすくなるが、Wonder Chronicle が確かめたい「変化の節目」が弱くなる。変化点抽出を別ビューに分離したほうが、既存の巻物型年表を壊さずに AI の価値を独立に検証できる。
- 実装への影響:
  `summaryTitle` は既存の仮ロジックを維持しつつ、別に `ChangePoint` のデータモデルを追加する。UI では `日 / 週 / 月 / 変化点` の表示モードを持ち、変化点年表も既存の年表ビューポート内で表示する。生成は明示アクションで OpenAI API を呼ぶ。API キーは `OPENAI_API_KEY` としてサーバー側 middleware でのみ読む。
- 将来戻すか/このまま採用するか:
  MVP の AI 実験としてこのまま採用する。Phase 2 以降で、変化点年表を社史型や時代区分へ発展させるかを再評価する。

## Implementation Rules Adopted

- 入力範囲は MVP では全 entry とする。
- 出力形式は `date + short text` を基本にする。
- 返却件数は最大 5 件とする。
- `Wish / Wonder at / Wonder about` の種別付与は今回見送る。
- 自動生成や永続キャッシュは入れず、`変化点` モードへ切り替えたときに確認ダイアログを出し、ユーザーが了承したときだけ生成する。
- 変化点年表は day / week / month のような選択対象にはせず、結果をそのまま読む閲覧ビューとする。
- `OPENAI_API_KEY` 未設定時は UI を壊さず unavailable 状態を表示する。

## Verification Notes

- 既存の day / week / month 年表と詳細パネルの挙動を維持する。
- OpenAI 未設定時でも通常の年表利用が継続できることを確認する。
- API 失敗時に変化点年表だけがエラー表示になり、全体 UI が崩れないことを確認する。
- mobile / desktop の両方で、変化点年表が既存 UI を圧迫しすぎないことを確認する。
