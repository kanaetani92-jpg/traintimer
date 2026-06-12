# タイマー操作→タイムライン順修正レポート

## 確認結果

- app.js: OK
- data-layer.js: OK
- service-worker.js: OK
- HTML ID重複：なし
- DOMでタイマー操作がタイムラインより前：OK
- CSS orderでタイマー操作30：OK
- CSS orderでタイムライン40：OK
- スマホgridでtimerがtimelineより前：OK
- PC用説明CSSあり：OK
- ゴールまで時間表示削除維持：OK
- これからすること未復活：OK
- 絵文字UI維持：OK
- 駅間時間補正維持：OK
- 保存形式V40：OK
- PWA V40：OK
- HTML参照V40：OK

## 未確認

- PC実ブラウザでの表示順
- iPhone Safari実機
- Android Chrome実機
- Service Workerの実登録
- ホーム画面からの起動
- 長時間利用

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
