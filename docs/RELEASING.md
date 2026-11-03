# Prepare a public source snapshot or release

## Check the source

Run from a fresh clone with the Node and pnpm versions used by CI:

```sh
pnpm install --frozen-lockfile
pnpm run check:public
pnpm audit
pnpm test
pnpm run build
pnpm release:check
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
pnpm tauri build --ci --debug --no-bundle
```

CI also scans the fetched Git history with Gitleaks and checks Rust dependencies against RustSec advisories. To run the Rust dependency check locally, install `cargo-audit` and run `cargo audit --file src-tauri/Cargo.lock`. Review informational warnings as well as vulnerability findings, including which target platforms actually use the affected dependency.

Review branches, tags, pull requests, workflow logs, and uploaded artifacts before making a previously private repository public. A clean working tree does not establish that its previous history is free of sensitive data.

Preserve the license files, the intentional public contact address, and the unofficial-integration notices. Review screenshots and video attachments for account information. Confirm that linked media is accessible to someone without repository access. Asset credits do not grant additional rights to lyrics, album artwork, recordings, or trademarks.

Read [SECURITY.md](../SECURITY.md) before reporting a vulnerability.

## Check native behavior before distributing installers

Passing unit tests and builds does not establish that provider login or playback works on a real installation. On each supported operating system, check:

- A fresh setup, operating system permissions, provider connection, and credential removal.
- Spotify and Apple Music playback detection, track changes, missing lyrics, translation, and selected-passage annotations.
- Each advertised CLI connection with its actual installed version and authentication method.
- Installation, startup, update download, signature verification, installation, and restart.

Keep Windows labeled as beta until its native flows have sufficient testing. The current macOS build uses ad-hoc signing without notarization. The Windows installer is not Authenticode signed. An updater signature verifies update artifacts; it is separate from operating system code signing.

## Configure a release repository

When moving to another GitHub repository, configure its Actions permissions and Secrets separately. Do not copy old private Git references into the new repository.

The tagged release workflow needs `TAURI_SIGNING_PRIVATE_KEY` and, when applicable, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never commit either value. The private key must match the public updater key in `src-tauri/tauri.conf.json`.

Check all three version fields with `pnpm release:check`. The release tag must be `v` followed by that version. `pnpm release:prepare` generates the updater configuration from `GITHUB_REPOSITORY` or `SONGDOCENT_UPDATE_REPOSITORY`. Ordinary source builds have no updater endpoint configured.

The tag-triggered release workflow publishes after all three platform artifacts have uploaded. Push a release tag only when you intend to publish. Verify the installers, signatures, checksums, and `latest.json` in the resulting release.
