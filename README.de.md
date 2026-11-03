<p align="center">
  <a href="README.ko.md"><kbd>한국어</kbd></a>
  ·
  <a href="README.md"><kbd>English</kbd></a>
  ·
  <a href="README.ja.md"><kbd>日本語</kbd></a>
  ·
  <a href="README.es.md"><kbd>Español</kbd></a>
  ·
  <a href="README.fr.md"><kbd>Français</kbd></a>
  ·
  <a href="README.de.md"><strong><kbd>Deutsch</kbd></strong></a>
  ·
  <a href="README.pt-BR.md"><kbd>Português (Brasil)</kbd></a>
  ·
  <a href="README.zh-CN.md"><kbd>简体中文</kbd></a>
</p>

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="SongDocent-Symbol" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>Musik hören und verstehen.</strong><br />
  Eine Desktop-App, die den Liedtext des laufenden Titels, eine KI-Übersetzung und den zugehörigen Kontext gemeinsam anzeigt.
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">Herunterladen</a> ·
  <a href="#getting-started">Erste Schritte</a> ·
  <a href="#development">Entwicklung</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">Problem melden</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; MIT
</p>

---

SongDocent ist Ihr persönlicher Musikbegleiter beim Hören mit Spotify und Apple Music. Die App erkennt den aktuellen Titel und zeigt den Originaltext und seine Übersetzung auf einem Bildschirm an. **AI Annotation** erklärt unbekannte Personen und kulturelle Bezüge. Wenn Sie mehr über eine Textstelle erfahren möchten, können Sie sie auswählen und eine Erklärung anfordern.

Die Musik wird wie gewohnt in Ihrer Spotify- oder Apple-Music-App abgespielt. SongDocent zeigt den Liedtext passend zum Wiedergabestatus an und ergänzt Übersetzungen und Erklärungen.

## Vorstellungsvideo

https://github.com/user-attachments/assets/516ed07d-9ee1-482d-9330-efef10c3377b

30-sekündige Vorstellung · V6. Einige Übergänge der Benutzeroberfläche, Übersetzungen und Anmerkungen dienen der Veranschaulichung. [Videoquellen](docs/media/v6-credits.md)

## Bildschirmfotos

Lesen Sie den Originaltext des in Spotify oder Apple Music laufenden Titels, die Übersetzung und KI-Anmerkungen zum kulturellen Hintergrund auf einem Bildschirm.

> [!WARNING]
> Die Liedtextanbindung von SongDocent verwendet inoffizielle Zugriffsmethoden statt einer offiziellen API. SongDocent ist kein offizielles Produkt von Spotify oder Apple. Änderungen an den Diensten können Funktionen unterbrechen. Die Richtlinien des Anbieters können dazu führen, dass Ihr Konto eingeschränkt oder gesperrt wird.

![SongDocent zeigt Otonoke von Creepy Nuts mit japanischem Liedtext, englischer Übersetzung und KI-Anmerkungen](docs/screenshots/lyrics-translation.png)

### Kultureller Kontext im Liedtext

KI-Anmerkungen unter unbekannten Ausdrücken helfen Ihnen, beim Lesen des Liedtextes auch den Hintergrund zu verstehen.

![Eine englische KI-Anmerkung erklärt den kulturellen Hintergrund des japanischen Ausdrucks Kuwa-bara](docs/screenshots/ai-annotation.png)

### Wählen Sie eine Textstelle aus

Wenn Sie einen Teil des Liedtextes mit der Maus markieren, erscheint die Schaltfläche **AI Annotation**. Sie können eine Erklärung zur ausgewählten Textstelle anfordern.

![Ein ausgewählter Teil eines japanischen Liedtextes mit sichtbarer Schaltfläche AI Annotation](docs/screenshots/lyric-selection.png)

### Wählen Sie die KI-Verbindung

Unter **Einstellungen → KI** wählen Sie zwischen CLI, API-Schlüssel und lokalem Modell. Auf der Registerkarte CLI können Sie installierte Werkzeuge prüfen, Modell und Websuche einstellen und die Verbindung testen.

![KI-Einstellungen mit Registerkarten für CLI, API-Schlüssel und lokales Modell sowie Modellauswahl und Verbindungstest für Codex CLI](docs/screenshots/ai-settings.png)

## Hauptfunktionen

| Funktion | Beschreibung |
| --- | --- |
| **Aktuellen Titel erkennen** | Ruft Titelinformationen, Albumcover und Wiedergabestatus aus den Desktop-Apps von Spotify und Apple Music ab. |
| **Liedtexte synchronisieren** | Hebt bei Liedtexten mit Zeitangaben die aktuelle Textstelle hervor und scrollt automatisch mit. |
| **Liedtexte mit KI übersetzen** | Lesen Sie Original und Übersetzung gemeinsam. Suchen und wählen Sie die gewünschte Übersetzungssprache. |
| **AI Annotation** | Ergänzt kurze Hintergrundinformationen zu Eigennamen und unbekannten kulturellen Bezügen im Liedtext. Die Dichte der Anmerkungen ist einstellbar. |
| **Ausgewählte Textstellen erklären** | Wählen Sie einen Teil des Liedtextes aus, um Erklärungen zu Nuancen, Wortspielen und Kontext anzufordern. |
| **KI-Verbindung wählen** | Nutzen Sie eine CLI, einen API-Schlüssel oder ein lokales LLM. Einzelheiten finden Sie in der [Tabelle zu den Verbindungsoptionen](#ai-connection-options) unten. |
| **Suche einbeziehen** | Bei unterstützten API- und CLI-Verbindungen können Sie die Websuche für Übersetzungs- oder Erklärungsanfragen aktivieren. |
| **Übersetzungen zwischenspeichern** | Lädt gespeicherte Übersetzungen passend zum Titel und zur Sprache erneut. |
| **Updates in der App** | In Release-Builds mit eingerichteten Updates können Sie in den Einstellungen neue Versionen suchen und installieren. |

Die Benutzeroberfläche unterstützt Koreanisch, Englisch, Japanisch, Spanisch, Französisch, Deutsch, brasilianisches Portugiesisch und vereinfachtes Chinesisch. **Die Sprache der Benutzeroberfläche und die Übersetzungssprache für Liedtexte lassen sich getrennt einstellen**.

## Herunterladen

Auf [GitHub Releases](https://github.com/kjsuo/songdocent/releases) finden Sie Installationsdateien für Ihr Betriebssystem und Ihre CPU. Falls noch keine Installationsdateien angezeigt werden, können Sie die App [aus dem Quellcode starten](#development).

| Umgebung | Zielplattform | Installationsformat |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | NSIS-Installationsprogramm `.exe` |

**Windows-Beta:** Die Windows-Version wurde noch nicht ausreichend getestet. Einige Funktionen funktionieren möglicherweise nicht wie erwartet. Bitte melden Sie auftretende Probleme.

Die aktuelle Veröffentlichungskonfiguration verwendet unter macOS eine Ad-hoc-Signatur und enthält keine Apple-Notarisierung. Falls die heruntergeladene App blockiert wird, prüfen Sie ihre Herkunft und verwenden Sie anschließend **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen**. Auch das Windows-Installationsprogramm besitzt keine Codesignatur.

<a id="getting-started"></a>

## Erste Schritte

1. **Spielen Sie einen Titel in der Desktop-App von Spotify oder Apple Music ab.**
2. **Öffnen Sie SongDocent und wählen Sie die App-Sprache.**
3. **Verbinden Sie einen Liedtextanbieter.** Wählen Sie Spotify oder Apple Music und folgen Sie den Verbindungshinweisen in der App. Die Anmeldung erfolgt in einem separaten Anmeldefenster. Falls die automatische Verbindung nicht funktioniert, können Sie die Anleitung zur manuellen Eingabe in den erweiterten Einstellungen verwenden.
4. **Richten Sie einen KI-Anbieter ein.** Wählen Sie in den Einstellungen einen API-Schlüssel, eine CLI oder ein lokales Modell als Verbindungsmethode. Für eine CLI führen Sie Installation und Anmeldung im Terminal durch. Suchen Sie danach in der App erneut nach der CLI und testen Sie die Verbindung. Für eine API geben Sie Ihren eigenen Schlüssel ein. Für ein lokales Modell geben Sie die Serveradresse und das Modell von Ollama oder LM Studio an.
5. **Wählen Sie die Übersetzungssprache und schließen Sie die Einrichtung ab.** Sobald Titel und Liedtext angezeigt werden, starten Sie **Übersetzen**. Wählen Sie eine Textstelle aus, wenn Sie dazu eine Erklärung wünschen.

Preise, Nutzungslimits und verfügbare Modelle der APIs und CLIs hängen vom gewählten Anbieter, der Authentifizierungsmethode des Kontos und dem Tarif ab. Auch bei einer CLI werden Anfragen an den KI-Dienst gesendet, der im jeweiligen Werkzeug eingerichtet ist. Qualität und Geschwindigkeit lokaler Modelle hängen vom Modell und der Leistung Ihres Computers ab.

<a id="ai-connection-options"></a>

### Optionen für die KI-Verbindung

| Verbindungsmethode | Unterstützte Werkzeuge und Anbieter | Voraussetzungen |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | Eine auf dem Computer installierte CLI mit Anmeldung oder eingerichteter Anbieterauthentifizierung |
| API-Schlüssel | Gemini, OpenAI, Claude | Ihr eigener API-Schlüssel und das gewünschte Modell |
| API-Schlüssel | OpenAI-kompatible API | Die Basis-URL des Dienstes, der Modellname und bei Bedarf ein API-Schlüssel |
| Lokales Modell | Ollama | Ein laufender Ollama-Server, der Name des installierten Modells und die Serveradresse |
| Lokales Modell | LM Studio | Ein laufender LM-Studio-Server, das geladene Modell und die Serveradresse |

### Mit einer CLI verbinden

1. Installieren Sie die CLI und melden Sie sich im Terminal nach der offiziellen Anleitung an. Die Installations- und Anmeldeanleitungen können Sie auch in der App über die Liste **Installierbare CLIs** öffnen.
2. Klicken Sie unter **Einstellungen → KI → CLI** auf **Erneut suchen** und wählen Sie die installierte CLI.
3. Wählen Sie ein Modell. Mit **CLI-Standard** verwenden Sie das Standardmodell der jeweiligen CLI. Modelle, die nicht in der Liste stehen, können Sie manuell eingeben.
4. Klicken Sie auf **Verbindung testen**. Der Test sendet mit den gewählten Einstellungen eine echte Anfrage und kann das Nutzungskontingent Ihres Kontos verbrauchen. Wiederholen Sie den Test, wenn Sie das Modell oder die Einstellungen für die Websuche ändern.

Falls die CLI nicht angezeigt wird, geben Sie unter **Erweitert: Pfad der ausführbaren Datei** den Pfad an und suchen Sie erneut. Installation und Anmeldung erfolgen im Terminal. SongDocent führt die verbundene CLI aus, um Übersetzungen und Anmerkungen anzufordern.

| CLI | Installationsanleitung | Anleitung zur Anmeldung |
| --- | --- | --- |
| Codex CLI | [Installation](https://developers.openai.com/codex/cli/) | [Authentifizierung](https://developers.openai.com/codex/auth/) |
| Claude Code | [Installation](https://code.claude.com/docs/en/setup) | [Authentifizierung](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [Installation](https://geminicli.com/docs/get-started/installation/) | [Authentifizierung](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [Installation](https://antigravity.google/docs/cli/install/) | [Authentifizierung](https://antigravity.google/docs/install/) |
| OpenCode | [Installation](https://opencode.ai/docs/) | [Anbieter verbinden](https://opencode.ai/docs/providers/) |

Die Websuche ist mit API- und CLI-Verbindungen verfügbar, die diese Funktion unterstützen. Wenn Sie die Suche in einer CLI aktivieren, prüfen Sie mit dem Verbindungstest, ob die Suche funktioniert und Quellen angezeigt werden. Die verfügbaren Modelle und Suchfunktionen hängen von der CLI-Version und vom Konto ab. Bei einem unerwarteten Antwortformat können Übersetzungs- und Anmerkungsanfragen fehlschlagen.

## Daten und Kontoinformationen

- **Zugangsdaten speichern:** API-Schlüssel und Sitzungsinformationen des Liedtextdienstes werden in macOS Keychain oder Windows Credential Manager gespeichert.
- **CLI-Authentifizierung:** CLI-Verbindungen nutzen die vorhandenen Authentifizierungseinstellungen des jeweiligen Werkzeugs. Die Anmeldung erfolgt im Terminal. Sie müssen keinen zusätzlichen API-Schlüssel in SongDocent eingeben. Wie die CLI ihre eigenen Zugangsdaten und Anfrageverläufe verarbeitet, hängt von den Einstellungen des jeweiligen Werkzeugs ab.
- **Verbindung zum Liedtextdienst:** Verwendet den Sitzungswert `sp_dc` von Spotify oder `media-user-token` von Apple Music. Bei der automatischen Verbindung prüft und speichert Rust diese Werte. An die Benutzeroberfläche wird nur der Verbindungsstatus übermittelt.
- **Anfragen senden:** Bei Liedtextanfragen werden Sitzungsinformationen an den gewählten Liedtextdienst gesendet. Wenn Sie eine Übersetzung oder Erklärung starten, werden der Liedtext, Titelinformationen und der erforderliche Kontext an den gewählten API-Anbieter, den in der CLI eingerichteten KI-Dienst oder den von Ihnen eingerichteten Server gesendet. Auch bei lokaler KI benötigt die Verbindung zum Liedtextdienst einen Netzwerkzugang.
- **Lokaler Cache:** Übersetzungen werden in Cache-Dateien auf dem Gerät gespeichert. Diese werden getrennt vom Speicher für Zugangsdaten verwaltet.
- **Eigene Server:** SongDocent betreibt keinen eigenen Server, der Sitzungscookies von Liedtextdiensten sammelt.

> **Die Liedtextanbindung ist eine inoffizielle Funktion.** SongDocent ist kein offizielles Produkt von Spotify oder Apple. Die Liedtextverbindung ist keine Integration über eine offizielle API. Änderungen an den Diensten können die Funktion unterbrechen. Die Richtlinien des Anbieters können dazu führen, dass Ihr Konto eingeschränkt oder gesperrt wird. Lesen Sie vor der Nutzung die Hinweise auf dem Verbindungsbildschirm.

KI-Übersetzungen und Erklärungen können Fehler enthalten. Auch Ergebnisse mit Websuche garantieren keine Richtigkeit. Die Verfügbarkeit von Liedtexten und ihre zeitliche Synchronisierung hängen vom Titel und vom Anbieter ab.

<a id="development"></a>

## Entwicklung

### Voraussetzungen

- Node.js 22 LTS
- pnpm: Verwenden Sie die unter `packageManager` in `package.json` angegebene Version
- Rust stable
- **macOS:** Xcode Command Line Tools
- **Windows:** Die Workload Desktopentwicklung mit C++ der Visual Studio Build Tools, MSVC-Werkzeuge und WebView2

### Aus dem Quellcode starten

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

Um nur die Benutzeroberfläche zu entwickeln, verwenden Sie diesen Befehl.

```sh
pnpm run dev
```

Der Entwicklungsserver öffnet sich unter `http://127.0.0.1:1420`. Tauri-Funktionen wie die Anbindung nativer Player und die Speicherung von Zugangsdaten müssen in der Desktop-App geprüft werden.

### Überprüfung

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

Unit- und Komponententests sowie Build-Prüfungen sind von der Überprüfung echter Spotify- und Apple-Music-Anmeldungen, der CLI-Authentifizierung und ihrer Anfragen, der Betriebssystemberechtigungen und der nativen Wiedergabe zu unterscheiden. Prüfen Sie vor einer öffentlichen Veröffentlichung den tatsächlichen Anmeldeablauf und die Verbindung zu den vorgesehenen CLIs unter macOS und Windows mit eigenen Testkonten.

### Erstellen

```sh
pnpm run tauri build
```

Die passende Konfiguration für den aktuellen Host wird automatisch gewählt.

| Plattform | Native Anbindung | Bundle-Konfiguration |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### Projektstruktur

```text
src/
  App.tsx                  Ansicht für Liedtext, Übersetzung und Player
  SettingsModal.tsx        Einstellungen für KI, Liedtexte und Sprache
  ai/                      KI-Verbindungsmethoden, CLI-Erkennung und Verbindungstests
  setup/                   Ersteinrichtung und Verbindungshinweise
  platform/                Betriebssystemspezifische Texte und Hinweise
src-tauri/
  src/
    player.rs              Gemeinsame Player-Befehle
    player_macos.rs        Player-Anbindung unter macOS
    player_windows.rs      Player-Anbindung unter Windows
    lyrics.rs              Liedtexte abrufen
    translation.rs         KI-Übersetzung und Erklärungen
    cli_ai/                CLI-Erkennung, Ausführung und Antwortverarbeitung
    grounding.rs           Ergänzung durch Suche
    cache.rs               Lokaler Übersetzungscache
    secrets.rs             Zugangsdatenverwaltung des Betriebssystems
    provider_connection.rs Anmeldung beim Liedtextdienst
    app_updates.rs         App-Updates
.github/workflows/         Automatisierung von Prüfungen, Installationsprogrammen und Releases
```

## Updates

Die Release-App sucht nach dem Start nach Updates. Unter **Einstellungen → Updates** können Sie auch selbst danach suchen, Updates herunterladen und installieren sowie die App neu starten. Installation und Neustart beginnen erst, wenn laufende Übersetzungen oder Erklärungen beendet sind. Unter macOS fordert die App nach der Installation zum Neustart auf. Unter Windows soll das Installationsprogramm die App schließen und neu starten. Dieses Verhalten wurde jedoch noch nicht ausreichend getestet.

## Mitwirken und Probleme melden

Melden Sie Fehler und Verbesserungsvorschläge unter [Issues](https://github.com/kjsuo/songdocent/issues). Geben Sie bei einem Fehlerbericht Betriebssystem, App-Version, Musik-App und KI-Anbieter, die Schritte zum Reproduzieren sowie das erwartete und das tatsächliche Verhalten an.

Allgemeine Fragen und Sicherheitsprobleme, die nicht öffentlich gemeldet werden sollen, können Sie an [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com) senden. Bei Problemen mit einer CLI-Verbindung geben Sie auch den Namen und die Version der CLI an.

Veröffentlichen Sie keine Protokolle oder Bildschirmfotos mit personenbezogenen Daten wie API-Schlüsseln, Sitzungscookies oder E-Mail-Adressen. Fügen Sie bei Vorschlägen für Codeänderungen die Ergebnisse der relevanten Tests und Builds bei.

## Lizenz

[MIT License](LICENSE). Für enthaltene externe Ressourcen wie Schriften und Symbole gelten die jeweiligen Lizenzen. Die entsprechenden Hinweise finden Sie unter [Schriftlizenz](public/fonts/Geist-LICENSE.txt), [Hinweise zu Anbieterlogos](public/provider-logos/README.md) und [Weitere Lizenzen](public/licenses/).
