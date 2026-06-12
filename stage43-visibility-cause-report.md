# 第1段階：端末別に見えづらい原因調査レポート

対象：`train_timer_stage42_split_creation_integrated_final` をベースに調査しました。  
この段階では、HTML/CSS/JavaScriptの大きなUI修正は行っていません。

## 1. 端末別に見えづらい主な原因

|device|cause|priority|recommended_fix|
|---|---|---|---|
|iPhone相当 390×844|固定下部ナビと100dvh内固定表示で、線路・操作・ナビが縦方向に競合しやすい。Safariアドレスバー伸縮も影響。|高|タイマー画面の情報量削減、線路高さの再調整、下部safe-area余白、作成フォームのカード分割。|
|Android相当 412×915|システムナビ、OS文字サイズ、キーボード表示で下部操作やフォームが押しにくくなる。|高|ボタン48px基準、固定高さを減らしてmin-height/gap中心、入力フォームの下余白を増やす。|
|小型スマホ 360px前後|ヘッダー、線路、現在区間、操作、下部ナビを1画面内に収めようとして文字と余白が圧縮される。|高|説明文の折りたたみ、線路形状別の高さ調整、359px以下専用の余白・文字サイズ。|
|iPad縦 768×1024|広めの1カラムは適切だが、線路が大きすぎると操作まで遠く、下部ナビが保存系操作に近づく。Split Viewでは急に狭くなる。|中|iPad縦は1カラム固定、カード最大幅、下部ナビとフォーム末尾の余白、Split View用600px台の確認。|
|タブレット横 1024×800|900px以上で2カラムになるが、右操作パネルが狭いと現在区間・操作ボタンが詰まる。タッチ端末なのでPCほど細かくできない。|中|右パネル最小幅を確保、操作ボタン48px、左線路の最大幅と余白を調整。|
|PC 1366×900|画面が広く、フォームやカードが横に伸びすぎると視線移動が大きい。下部ナビは非表示だが操作パネル幅と最大幅設計が重要。|中|全体max-width、右操作パネル幅固定、My設定2〜3列、入力欄最大幅を設定。|

## 2. 優先して直すべき画面

|rank|screen|reason|next_stage|
|---|---|---|---|
|1|スマホのタイマー画面|線路、現在区間、操作、下部ナビが縦方向に集中して見えづらさに直結する。|第2段階|
|2|線路表示エリア|横・縦・円形で必要高さが違い、駅名と電車位置のずれが端末差として出る。|第3段階|
|3|操作ボタンと下部ナビ|誤操作・押しづらさ・見切れに直結する。|第4段階|
|4|新しい電車追加フォーム|駅数指定・自動分割・プレビューで情報量が増え、スマホで長くなる。|第5段階|
|5|My設定・経路編集・設定|管理機能が多く、カード階層と危険操作の位置整理が必要。|第6段階|
|6|PC・タブレット横|2カラムは有効だが、右パネル幅と全体最大幅の再調整が必要。|第7段階|

## 3. HTML構造上の確認結果

- タイマー画面は、線路表示エリアと操作カードに分かれており、タイマー画面に運行中の電車リストは戻っていません。
- `createTrainPanel` はモーダル型の下部シートです。スマホではキーボード表示時に保存ボタンが見切れる可能性があります。
- `pageEdit` には `route-editor-actions` があり、スマホ下部ナビと近くなりやすい構成です。
- `mobile-bottom-nav` は独立した固定ナビで、スマホ・タブレット縦の見え方に強く影響します。

詳細は `stage43-html-structure-audit.csv` を参照してください。

## 4. CSS上の見えづらさの原因

静的に確認したリスク候補は以下です。

- `position` 系リスク候補：49件
- `top/left/bottom/right` の％指定候補：21件
- `!important` を含む候補：88件

特に注意が必要な箇所は以下です。

|area|selector_or_element|line|risk|priority|
|---|---|---|---|---|
|タイマー画面|body.page-timer-active, .app-shell|5584|height:100dvh + overflow:hidden により、端末高さが足りないと下部が切れやすい。|高|
|タイマー画面|#pageTimer .railway-card|4631|grid-template-rows固定 + overflow:hidden により、駅名や線路内表示が見切れる可能性。|高|
|タイマー画面|#pageTimer .railway-preview|4643|height:100% !important + overflow:hidden で、形状ごとの必要高さを吸収しにくい。|高|
|タイマー画面|.mobile-bottom-nav|2886|スマホで固定表示のため、操作ボタン・保存ボタン・フォーム末尾を隠す可能性。|高|
|経路編集|.route-editor-actions|5954|sticky bottom と下部ナビが同時に存在する幅で重なりやすい。|中|
|新しい電車追加|.create-train-panel|7078|fixed bottom + max-height 94vh。スマホキーボード表示時に保存ボタンが見切れる可能性。|高|
|線路表示|track-bed/station/train-position top:43%|6646|線路内部としては許容だが、親高さが圧縮されると駅名・電車位置が窮屈になる。|中|

`%` 指定は、駅・電車・線路上の進行表示では許容できます。一方、操作ボタン、現在区間カード、作成フォーム、下部ナビには使わない方針を維持する必要があります。

## 5. JavaScript処理上の確認結果

- 駅数指定と自動分割は `creationMode` で分岐できる状態です。
- `renderActiveTrainsList()` は My設定側の運行中リストを担当しています。
- `updateCreateTrainPreview()` と `validateCreateTrainRawValues()` は、新しい電車追加フォームの見えやすさ・保存可否に関係します。
- `positionTrainForShape()` は線路形状ごとの電車位置に関係するため、線路内部の％配置として扱うのが妥当です。

詳細は `stage43-js-process-audit.csv` を参照してください。

## 6. ％指定が残っている箇所の扱い

### 残してよい箇所

- `.railway-track--horizontal .station`
- `.railway-track--horizontal .train-position`
- `.railway-track--horizontal .track-bed`
- `.railway-track--vertical .station`
- `.railway-track--vertical .train-position`
- `.railway-track--circle` 内の円形配置
- `.active-train-progress > span` の進捗幅
- `journeyProgressBar` の進捗幅

### 見直し候補

- `#pageTimer .railway-preview` の `height:100% !important` と `overflow:hidden !important`
- `#pageTimer .railway-card` の `overflow:hidden !important`
- `body.page-timer-active` の `overflow: hidden`
- `.create-train-panel` の fixed bottom / max-height
- `.mobile-bottom-nav` の固定下部配置

## 7. position:absolute / fixed / sticky の扱い

### 許容しやすいもの

- 駅、線路、電車、進行位置などの線路内部
- モーダルやロックオーバーレイなど、画面全体を覆うUI

### 注意が必要なもの

- 下部固定ナビ
- 新しい電車追加パネル
- 経路編集の保存ボタン
- タイマー画面の `overflow:hidden` と組み合わさる固定高さ

詳細は `stage43-css-risk-selectors.csv` を参照してください。

## 8. 下部ナビと重なりそうな要素

- タイマー画面の操作ボタン群
- 経路編集ページの `変更を反映する / 変更を取り消す`
- 新しい電車追加パネルの保存ボタン
- 設定ページの末尾項目
- データ管理・削除系の下部ボタン

## 9. 第2段階以降の修正方針

1. スマホのタイマー画面を軽くする  
   線路・現在区間・操作・下部ナビの縦方向競合を減らします。
2. 線路表示エリアを端末・形状別に調整する  
   横・縦・円形で高さと余白を分けます。
3. 操作ボタンと下部ナビの重なりを解消する  
   すべてGrid/Flexで配置し、下部余白を強化します。
4. 新しい電車追加フォームをカード分割する  
   作り方、時間、線路、プレビュー、保存を分けます。
5. My設定・経路編集・設定ページの情報階層を整理する  
   すぐ使う、運行中、新規追加、危険操作の優先順位を明確にします。
6. PC・タブレット横の2カラムを再調整する  
   右操作パネル幅、全体最大幅、入力欄最大幅を整理します。
7. 端末別統合確認を行う  
   390/412/360/768/1024/1366幅で横スクロール・重なり・主要操作を確認します。

## 10. ブラウザ確認について

`localhost` / `file://` はこの環境では遮断されるため、HTML/CSS/JavaScriptをChromiumへ直接展開してレイアウトメトリクスを取得しました。localStorageは実URLではないため、永続保存の実機確認は未実施です。詳細は `stage43-browser-layout-metrics.csv` を参照してください。
