# xcli

Experiential Labs の OpenAI 互換ゲートウェイを使う、TypeScript 製ターミナルコーディングエージェントや。Node.js 20 以上が必要やで。

## セットアップ

APIキーは環境変数 `EXPLABS_API_KEY` に設定する。キーをファイルやコマンド例に書かんようにしてな。

```powershell
$env:EXPLABS_API_KEY = "（自分のキー）"
cd packages/xcli
npm link
```

macOS / Linux の場合は `export EXPLABS_API_KEY='（自分のキー）'` を使う。

## 使い方

```sh
xcli
xcli "このプロジェクトの構成を説明して"
xcli -p "README.mdを要約して"
xcli --model deepseek-v4.1-flash:free
xcli --yes --no-web -p "srcを確認して概要を説明して"
xcli models
xcli sessions
```

通常起動は対話REPLや。`/help` でモデル切替、会話のリセット、要約、使用量確認、セッション再開などのコマンドを見られる。変更系ツールは許可を求めるで。`--yes` は許可確認を省略する。`--print` は一度だけ実行し、標準入力がTTYでない場合は `--yes` が無い限り変更系ツールを拒否する。

## モデル

登録されていないモデルコードも `--model` や `/model` に指定すればそのまま使える。モデルコードが後から追加された場合も、再インストールせずコードを直接指定できる。登録する場合:

```sh
xcli model add vendor/model-code --alias short --context 128000
xcli model add vendor/model-code --no-tools
xcli model list
xcli model rm short
```

登録時には `--base-url URL` と `--api-key-env ENV_NAME` で、そのモデルだけ別のゲートウェイとキー環境変数を指定できる。

## Web ツール

WebFetch / WebSearch は初期状態で有効で、Web取得先に制限は設けてへん。`--no-web` で無効化できる。WebSearch は追加設定なしでは DuckDuckGo を使い、以下の検索サービス環境変数があれば優先して使う。

- `TAVILY_API_KEY`
- `BRAVE_API_KEY`
- `SEARXNG_URL`

## 設定とセッション

設定ファイルは `~/.xcli/config.json`、セッションは `~/.xcli/sessions/` に保存する。`XCLI_HOME` を設定すると保存先を変更できる。既定モデル、APIのBase URL、モデル別名やコンテキスト長も設定ファイルに保存される。
