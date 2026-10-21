# Changelog

このプロジェクトの主な変更点を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、バージョン番号は [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [0.3.0] - 2026-10-21

### Added

- `toCSV()`: 支払スケジュールを CSV 文字列にする。見出しの言語（英語 / 日本語 / なし）、Excel 向け BOM、改行コードを指定可能
- CLI: `--csv` で日本語見出しの CSV を出力

## [0.2.0] - 2026-10-21

### Added

- CLI: `-v` / `--version` でバージョンを表示
- GitHub Actions による CI（Node 18 / 20 / 22）

### Fixed

- CLI: `--adjust` / `--calendar` に不正な値を渡すと黙ってデフォルト扱いになっていた問題を修正し、エラーで終了するように
- CLI: `--count` に0・負数・小数を渡すと1件として扱っていた問題を修正し、エラーで終了するように
- CLI: 不明なオプションを支払条件として解釈していた問題を修正

## [0.1.0] - 2026-10-21

### Added

- 初回リリース。支払条件文字列のパース、締め日・支払期日の計算、休業日調整、日本の祝日計算、CLI

[0.3.0]: https://github.com/makumaaku/shimebi/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/makumaaku/shimebi/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/makumaaku/shimebi/releases/tag/v0.1.0
