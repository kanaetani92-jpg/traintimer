# おしたくトレイン タイマー操作→タイムライン順修正版

作成日：2026-06-12

この版では、PC版で「タイマー操作」の下に「タイムライン」が来るように、表示順を明示しました。

## 修正内容

- PC版で `viewTimerControls` の下に `track-wrap` が来る順番をCSSで明示
- スマホ版でも、カード → できた！ → タイマー操作 → タイムライン の順番に統一
- DOM順が混在しても、CSSの `order` でタイマー操作が先、タイムラインが後になるよう補強
- 保存形式とPWAキャッシュをV40へ更新

## 保存形式

`oshitakuTrainNoPhotoStateV40`

## PWAキャッシュ

`oshitaku-train-pwa-v40`

## GitHub

GitHubへのcommit、push、PR作成、ブランチ操作、デプロイは行っていません。
