# Security policy

## Report a vulnerability privately

Email [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com) with a description, affected version or commit, reproduction steps, and the expected impact. Use a test account and redact credentials from examples.

Do not post session cookies, API keys, private logs, or working exploit details in public issues. If you accidentally disclose a credential, revoke or replace it immediately. Deleting a message or file does not invalidate the credential.

Security fixes target the latest source on `main`. Older versions do not have a separate maintenance commitment. Response times are not guaranteed for this independently maintained project.

## Credentials and external services

SongDocent stores credentials in the operating system credential store. CLI connections use the selected tool's authentication and service. Translation and annotation requests send lyrics and song context to the configured AI destination. Only configure API endpoints, CLI executables, and local servers that you trust.

Lyrics connections use unofficial Spotify and Apple Music access methods. The project does not guarantee continued compatibility or provider approval. Read the account-risk notices before connecting an account.

For ordinary bugs and feature requests, use [GitHub Issues](https://github.com/kjsuo/songdocent/issues).
