# 第4段階：作成プレビューと入力チェック 検証メモ

## 実装概要

- 「新しい電車を追加」画面の作成プレビューを、作り方・全体時間・駅数・1駅間の目安・線路形状に連動して更新するように整理しました。
- プレビューに「全体」「駅」「駅間」「1駅間」または「駅間時間」を表示するようにしました。
- 保存ボタンの近くに「この内容で電車を作ります」の説明を追加しました。
- 入力が保存できない状態では、やさしいエラー文を表示し、保存ボタンを無効化するようにしました。
- アプリバージョンを 1.17.8 に更新しました。
- Service Worker のキャッシュ名を train-timer-v1.17.8 に更新しました。

## 追加・変更した主な要素

### index.html

- `newTrainAutoPreview`
  - 作成プレビューの初期表示を詳細化しました。
- `newTrainSubmitHint`
  - 保存ボタンの近くに、現在の作成内容またはエラーを表示します。
- `createTrainSubmitButton`
  - 保存可否に応じて `disabled` / `aria-disabled` を切り替えます。

### app.js

- `readIntegerInputValue()`
- `getCreateTrainRawFormValues()`
- `validateCreateTrainRawValues()`
- `formatSegmentMinutesForPreview()`
- `updateCreateTrainSubmitState()`
- `updateCreateTrainPreview()` の拡張
- `handleCreateTrainSubmit()` の保存前バリデーション追加

### style.css

- `.create-train-preview-summary`
- `.create-train-preview-errors`
- `.create-train-preview-warning`
- `.create-train-submit-area`
- `.create-train-submit-hint`
- `#createTrainSubmitButton:disabled`

## 確認した内容

### 静的確認

- `app.js` 構文エラーなし
- `sw.js` 構文エラーなし
- `manifest.webmanifest` JSON形式正常
- HTMLのID重複なし
- JavaScript参照IDの欠落なし
- ARIA参照切れなし
- CSS波括弧数一致
- ZIP破損なし
- APIキー・秘密鍵なし
- 旧デモ由来の禁止語がアプリ本体ファイルに含まれていないこと

### 仕様確認

- 駅数指定モードで保存前プレビューを表示する実装になっていること
- 自動分割モードで保存前プレビューを表示する実装になっていること
- 入力変更時にプレビュー更新が走ること
- 保存不可の入力では保存ボタンが無効化されること
- 保存時にもバリデーションが再実行されること

## 未確認項目

この環境では Chromium の通常起動・スクリーンショット取得がタイムアウトしました。そのため、実機ブラウザでの視覚確認とクリック確認は未完了です。

実機またはHTTPS環境で、以下を確認してください。

- iPhone Safariでの新しい電車追加画面
- Android Chromeでのキーボード表示時の入力欄位置
- iPad Split Viewでのプレビュー表示
- PCでの保存ボタン無効化表示
- PWAインストール後のService Worker更新

## GitHub反映

GitHubへのcommit、push、ブランチ作成、Pull Request作成、GitHub上の直接編集、デプロイは行っていません。
