<p align="center">
  <a href="README.ko.md"><kbd>한국어</kbd></a>
  ·
  <a href="README.md"><kbd>English</kbd></a>
  ·
  <a href="README.ja.md"><kbd>日本語</kbd></a>
  ·
  <a href="README.es.md"><strong><kbd>Español</kbd></strong></a>
  ·
  <a href="README.fr.md"><kbd>Français</kbd></a>
  ·
  <a href="README.de.md"><kbd>Deutsch</kbd></a>
  ·
  <a href="README.pt-BR.md"><kbd>Português (Brasil)</kbd></a>
  ·
  <a href="README.zh-CN.md"><kbd>简体中文</kbd></a>
</p>

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="Icono de SongDocent" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>De escuchar música a comprenderla.</strong><br />
  Una aplicación de escritorio para leer las letras de la canción que suena, su traducción con IA y su contexto.
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">Descargar</a> ·
  <a href="#getting-started">Primeros pasos</a> ·
  <a href="#development">Desarrollo</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">Informar de un problema</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; MIT
</p>

---

SongDocent es tu guía musical personal mientras escuchas música en Spotify y Apple Music. Detecta la canción que se está reproduciendo y muestra la letra original y su traducción en una misma pantalla. **AI Annotation** aporta contexto sobre personajes y referencias culturales desconocidos. También puedes seleccionar un fragmento para pedir una explicación más detallada.

La música se reproduce en la aplicación de Spotify o Apple Music que utilizas habitualmente. SongDocent muestra las letras según el estado de reproducción y añade traducciones y explicaciones.

## Vídeo de presentación

[SongDocent · V7](docs/media/songdocent-intro.mp4)

Presentación de 30 segundos · V7. Algunas transiciones de la interfaz, traducciones y anotaciones son ilustrativas. [Créditos del vídeo](docs/media/v7-credits.md)

## Capturas de pantalla

Lee en una misma pantalla la letra original de la canción que suena en Spotify o Apple Music, su traducción y las anotaciones de IA que explican su contexto cultural.

> [!WARNING]
> La integración de letras de SongDocent utiliza métodos de acceso no oficiales en lugar de una API oficial. SongDocent no es un producto oficial de Spotify ni de Apple. Los cambios en los servicios pueden interrumpir sus funciones, y las políticas del proveedor pueden dar lugar a restricciones o a la suspensión de tu cuenta.

![SongDocent muestra Otonoke de Creepy Nuts con la letra en japonés, su traducción al inglés y anotaciones de IA](docs/screenshots/lyrics-translation.png)

### Contexto cultural de las letras

Las anotaciones de IA aparecen debajo de las expresiones desconocidas para que puedas entender su contexto mientras lees la letra.

![Una anotación de IA en inglés explica el contexto cultural de la expresión japonesa Kuwa-bara](docs/screenshots/ai-annotation.png)

### Selecciona el fragmento que te interese

Al seleccionar parte de la letra con el ratón, aparece el botón **AI Annotation**. Puedes solicitar una explicación del fragmento seleccionado.

![Parte de una letra en japonés seleccionada con el botón AI Annotation visible](docs/screenshots/lyric-selection.png)

### Elige cómo conectarte a la IA

En **Ajustes → IA**, elige entre una CLI, una clave de API o un modelo local. La pestaña CLI permite comprobar las herramientas instaladas, configurar el modelo y la búsqueda web, y probar la conexión.

![Ajustes de IA con las pestañas CLI, clave de API y modelo local, la selección de modelo de Codex CLI y la prueba de conexión](docs/screenshots/ai-settings.png)

## Funciones principales

| Función | Descripción |
| --- | --- |
| **Detección de la canción en reproducción** | Obtiene la información de la canción, la carátula y el estado de reproducción de las aplicaciones de escritorio de Spotify y Apple Music. |
| **Sincronización de letras** | Resalta el fragmento actual y desplaza la letra automáticamente cuando dispone de marcas de tiempo. |
| **Traducción de letras con IA** | Lee el original y la traducción juntos. Busca y selecciona el idioma de traducción que prefieras. |
| **AI Annotation** | Añade breves explicaciones sobre nombres propios y referencias culturales desconocidas de las letras. También puedes ajustar la densidad de las anotaciones. |
| **Explicación de fragmentos seleccionados** | Selecciona parte de la letra para solicitar una explicación de sus matices, juegos de palabras y contexto. |
| **Opciones de conexión a la IA** | Puedes usar una CLI, una clave de API o un LLM local. Consulta la [tabla de opciones de conexión](#ai-connection-options) a continuación para más detalles. |
| **Apoyo con búsquedas** | En las conexiones API y CLI compatibles, puedes activar la búsqueda web para las solicitudes de traducción o explicación. |
| **Caché de traducciones** | Recupera las traducciones guardadas según la canción y el idioma. |
| **Actualizaciones desde la aplicación** | En las compilaciones de lanzamiento con actualizaciones configuradas, puedes buscar e instalar nuevas versiones desde los ajustes. |

La interfaz admite coreano, inglés, japonés, español, francés, alemán, portugués de Brasil y chino simplificado. **El idioma de la interfaz y el idioma de traducción de las letras se configuran por separado**.

## Descargar

Consulta los instaladores disponibles para tu sistema operativo y CPU en [GitHub Releases](https://github.com/kjsuo/songdocent/releases). Si todavía no aparecen instaladores, puedes [ejecutar la aplicación desde el código fuente](#development).

| Entorno | Destino de distribución | Formato de instalación |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | Instalador NSIS `.exe` |

**Windows beta:** La versión para Windows aún no se ha probado lo suficiente. Es posible que algunas funciones no funcionen como se espera. Informa de cualquier problema.

La configuración de distribución actual utiliza una firma ad hoc en macOS y no incluye la notarización de Apple. Si el sistema bloquea la aplicación descargada, verifica su procedencia y usa **Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente**. El instalador de Windows tampoco tiene firma de código.

<a id="getting-started"></a>

## Primeros pasos

1. **Reproduce una canción en la aplicación de escritorio de Spotify o Apple Music.**
2. **Abre SongDocent y selecciona el idioma de la aplicación.**
3. **Conecta un proveedor de letras.** Selecciona Spotify o Apple Music y sigue las instrucciones de conexión de la aplicación. La autenticación se realiza en una ventana de inicio de sesión independiente. Si la conexión automática no funciona, puedes seguir las instrucciones de entrada manual de los ajustes avanzados.
4. **Configura un proveedor de IA.** En los ajustes, elige una clave de API, una CLI o un modelo local. Para usar una CLI, instálala e inicia sesión desde el terminal. Después, vuelve a buscarla en la aplicación y prueba la conexión. Para una API, introduce tu propia clave. Para un modelo local, especifica la dirección del servidor de Ollama o LM Studio y el modelo.
5. **Selecciona el idioma de traducción y completa la configuración.** Cuando aparezcan la canción y su letra, pulsa **Traducir**. Selecciona cualquier fragmento sobre el que quieras pedir una explicación.

Los precios, los límites de uso y los modelos disponibles de las API y CLI dependen del proveedor elegido, del método de autenticación de la cuenta y del plan contratado. Aunque uses una CLI, las solicitudes se envían al servicio de IA configurado en esa herramienta. La calidad y la velocidad de los modelos locales dependen del modelo y de las especificaciones de tu ordenador.

<a id="ai-connection-options"></a>

### Opciones de conexión a la IA

| Tipo de conexión | Herramientas y proveedores compatibles | Qué necesitas |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | La CLI instalada en el ordenador y el inicio de sesión o la autenticación del proveedor configurados en esa herramienta |
| Clave de API | Gemini, OpenAI, Claude | Tu propia clave de API y el modelo que vas a usar |
| Clave de API | API compatible con OpenAI | La URL base del servicio, el nombre del modelo y una clave de API si se requiere |
| Modelo local | Ollama | Un servidor de Ollama en ejecución, el nombre del modelo instalado y la dirección del servidor |
| Modelo local | LM Studio | Un servidor de LM Studio en ejecución, el modelo cargado y la dirección del servidor |

### Conectar mediante una CLI

1. Instala la CLI e inicia sesión desde el terminal siguiendo sus instrucciones oficiales. También puedes abrir las instrucciones de instalación e inicio de sesión desde la lista **CLI disponibles para instalar** de la aplicación.
2. En **Ajustes → IA → CLI**, pulsa **Volver a buscar** y selecciona la CLI instalada.
3. Selecciona un modelo. La opción **Predeterminado de la CLI** utiliza el modelo predeterminado de esa CLI. Si el modelo no aparece en la lista, puedes introducirlo manualmente.
4. Pulsa **Probar conexión**. La prueba envía una solicitud real con la configuración seleccionada y puede consumir la cuota de tu cuenta. Repite la prueba después de cambiar el modelo o la configuración de búsqueda web.

Si la CLI no aparece, especifica su ruta en **Avanzado: ruta del ejecutable** y vuelve a buscar. La instalación y el inicio de sesión se realizan desde el terminal. SongDocent ejecuta la CLI conectada para solicitar traducciones y anotaciones.

| CLI | Instrucciones de instalación | Instrucciones de inicio de sesión |
| --- | --- | --- |
| Codex CLI | [Instalación](https://developers.openai.com/codex/cli/) | [Autenticación](https://developers.openai.com/codex/auth/) |
| Claude Code | [Instalación](https://code.claude.com/docs/en/setup) | [Autenticación](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [Instalación](https://geminicli.com/docs/get-started/installation/) | [Autenticación](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [Instalación](https://antigravity.google/docs/cli/install/) | [Autenticación](https://antigravity.google/docs/install/) |
| OpenCode | [Instalación](https://opencode.ai/docs/) | [Conectar un proveedor](https://opencode.ai/docs/providers/) |

La búsqueda web está disponible en las conexiones API y CLI que la admiten. Si la activas en una CLI, usa la prueba de conexión para comprobar que la búsqueda funciona y que aparecen las fuentes. Los modelos y las funciones de búsqueda disponibles dependen de la versión de la CLI y de la cuenta. Si el formato de respuesta no coincide con el esperado, las solicitudes de traducción o anotación pueden fallar.

## Datos e información de la cuenta

- **Almacenamiento de credenciales:** Las claves de API y la información de sesión del servicio de letras se guardan en macOS Keychain o Windows Credential Manager.
- **Autenticación de la CLI:** Las conexiones CLI utilizan la configuración de autenticación existente de cada herramienta. El inicio de sesión se realiza desde el terminal y no es necesario introducir una clave de API adicional en SongDocent. La gestión de las credenciales y del historial de solicitudes de la CLI depende de la configuración de cada herramienta.
- **Conexión al servicio de letras:** Utiliza los valores de sesión `sp_dc` de Spotify o `media-user-token` de Apple Music. Durante la conexión automática, Rust valida y guarda los valores. Solo se transmite a la interfaz el estado de la conexión.
- **Envío de solicitudes:** Las solicitudes de letras envían información de sesión al servicio de letras seleccionado. Al traducir o solicitar una explicación, la letra, la información de la canción y el contexto necesario se envían al proveedor de API elegido, al servicio de IA configurado en la CLI o al servidor que hayas configurado. La conexión al servicio de letras requiere acceso a la red incluso si eliges una IA local.
- **Caché local:** Las traducciones se guardan en archivos de caché del dispositivo. Se gestionan por separado del almacén de credenciales.
- **Servidores propios:** SongDocent no opera ningún servidor propio que recopile las cookies de sesión de los servicios de letras.

> **La integración de letras es una función no oficial.** SongDocent no es un producto oficial de Spotify ni de Apple, y la conexión de letras no es una integración con una API oficial. Los cambios en los servicios pueden interrumpir su funcionamiento, y las políticas del proveedor pueden dar lugar a restricciones o a la suspensión de tu cuenta. Lee las indicaciones de la pantalla de conexión antes de usarla.

Las traducciones y explicaciones de IA pueden contener errores. Los resultados que utilizan búsquedas tampoco garantizan la exactitud. La disponibilidad de las letras y su sincronización temporal varían según la canción y el proveedor.

<a id="development"></a>

## Desarrollo

### Requisitos

- Node.js 22 LTS
- pnpm: usa la versión indicada en `packageManager` en `package.json`
- Rust stable
- **macOS:** Xcode Command Line Tools
- **Windows:** La carga de trabajo de desarrollo para el escritorio con C++ de Visual Studio Build Tools, las herramientas MSVC y WebView2

### Ejecutar desde el código fuente

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

Para desarrollar solo la interfaz, usa el siguiente comando.

```sh
pnpm run dev
```

El servidor de desarrollo se abre en `http://127.0.0.1:1420`. Las funciones de Tauri, como la integración con los reproductores nativos y el almacenamiento de credenciales, deben comprobarse en la aplicación de escritorio.

### Verificación

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

Las pruebas unitarias y de componentes y las comprobaciones de compilación se distinguen de la verificación del inicio de sesión real en Spotify o Apple Music, la autenticación y las solicitudes de CLI, los permisos del sistema operativo y la reproducción nativa. Antes de publicar una versión, comprueba el flujo real de inicio de sesión y la conexión de las CLI que vayas a usar en macOS y Windows con cuentas de prueba dedicadas.

### Compilar

```sh
pnpm run tauri build
```

La configuración correspondiente al equipo anfitrión actual se selecciona automáticamente.

| Plataforma | Integración nativa | Configuración del paquete |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### Estructura del proyecto

```text
src/
  App.tsx                  Pantalla de letras, traducción y reproductor
  SettingsModal.tsx        Ajustes de IA, letras e idioma
  ai/                      Tipos de conexión a la IA, detección de CLI y pruebas de conexión
  setup/                   Configuración inicial e instrucciones de conexión
  platform/                Textos e instrucciones específicos del sistema operativo
src-tauri/
  src/
    player.rs              Comandos comunes del reproductor
    player_macos.rs        Integración del reproductor en macOS
    player_windows.rs      Integración del reproductor en Windows
    lyrics.rs              Obtención de letras
    translation.rs         Traducción y explicaciones de IA
    cli_ai/                Detección, ejecución y procesamiento de respuestas de CLI
    grounding.rs           Apoyo con búsquedas
    cache.rs               Caché local de traducciones
    secrets.rs             Almacén de credenciales del sistema operativo
    provider_connection.rs Conexión de inicio de sesión al servicio de letras
    app_updates.rs         Actualizaciones de la aplicación
.github/workflows/         Automatización de verificaciones, instaladores y lanzamientos
```

## Actualizaciones

La aplicación de lanzamiento busca actualizaciones después de iniciarse. También puedes buscarlas, descargarlas, instalarlas y reiniciar desde **Ajustes → Actualizaciones**. La instalación y el reinicio se realizan una vez finalizadas las traducciones o explicaciones en curso. En macOS se indica que reinicies después de la instalación. En Windows, el instalador está diseñado para cerrar y reiniciar la aplicación, pero este comportamiento aún no se ha probado lo suficiente.

## Contribuciones e informes de problemas

Publica los errores y las sugerencias de mejora en [Issues](https://github.com/kjsuo/songdocent/issues). Al informar de un error, incluye el sistema operativo, la versión de la aplicación, la aplicación de música y el proveedor de IA, los pasos para reproducirlo, el comportamiento esperado y el real.

Para consultas generales y problemas de seguridad que no deban hacerse públicos, escribe a [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com). Si informas de un problema de conexión con una CLI, incluye también su nombre y versión.

No publiques registros ni capturas de pantalla que contengan datos personales, como claves de API, cookies de sesión o direcciones de correo electrónico. Al proponer cambios de código, incluye los resultados de las pruebas y compilaciones pertinentes.

## Licencia

[MIT License](LICENSE). Los recursos externos incluidos, como fuentes e iconos, están sujetos a sus propias licencias. Consulta los avisos en [Licencia de las fuentes](public/fonts/Geist-LICENSE.txt), [Información sobre los logotipos de proveedores](public/provider-logos/README.md) y [Otras licencias](public/licenses/).
