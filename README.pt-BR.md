<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="Ícone do SongDocent" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>Da música que você ouve à música que você entende.</strong><br />
  Um app para desktop para ler a letra da música em reprodução, a tradução por IA e seu contexto.
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kjsuo/songdocent/ci.yml?branch=main&amp;style=plastic&amp;label=build" alt="Build status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=plastic" alt="License: AGPL-3.0-only" /></a>
  <a href="https://github.com/kjsuo/songdocent"><img src="https://img.shields.io/github/stars/kjsuo/songdocent?style=plastic" alt="GitHub stars" /></a>
  <a href="https://buymeacoffee.com/kjsuo"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-ffdd00?style=plastic&amp;logo=buymeacoffee&amp;logoColor=white" alt="Support on Buy Me a Coffee" /></a>
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">Baixar</a> ·
  <a href="#getting-started">Primeiros passos</a> ·
  <a href="#development">Desenvolvimento</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">Relatar um problema</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; AGPL-3.0-only
</p>

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
  <a href="README.de.md"><kbd>Deutsch</kbd></a>
  ·
  <a href="README.pt-BR.md"><strong><kbd>Português (Brasil)</kbd></strong></a>
  ·
  <a href="README.zh-CN.md"><kbd>简体中文</kbd></a>
</p>

---

O SongDocent é seu guia pessoal para acompanhar a música que você ouve no Spotify e no Apple Music. Ele detecta a música em reprodução e mostra a letra original e a tradução na mesma tela. O **AI Annotation** explica pessoas e referências culturais desconhecidas. Você também pode selecionar um trecho para pedir uma explicação.

Reproduza suas músicas no app do Spotify ou do Apple Music que você já usa. O SongDocent acompanha a reprodução, exibe a letra e acrescenta traduções e explicações.

## Vídeo de apresentação

https://github.com/user-attachments/assets/f8017c97-470a-4ff9-aa55-8ef45ebfbb02

[Créditos do vídeo](docs/media/v7-credits.md)

## Capturas de tela

Leia, na mesma tela, a letra original da música em reprodução no Spotify ou no Apple Music, a tradução e as anotações por IA que explicam seu contexto cultural.

> [!WARNING]
> A integração de letras do SongDocent usa métodos de acesso não oficiais, em vez de APIs oficiais. O SongDocent não é um produto oficial do Spotify nem da Apple. Mudanças nos serviços podem interromper as funções, e as políticas dos provedores podem resultar em restrição ou suspensão da conta.

![SongDocent reproduzindo Otonoke, do Creepy Nuts, com a letra em japonês, a tradução em inglês e anotações por IA na mesma tela](docs/screenshots/lyrics-translation.png)

### Contexto cultural nas letras

As anotações por IA aparecem abaixo de expressões desconhecidas para ajudar você a entender o contexto enquanto lê a letra.

![Anotação por IA em inglês explicando o contexto cultural da expressão japonesa Kuwa-bara](docs/screenshots/ai-annotation.png)

### Selecione o trecho que deseja entender

Arraste para selecionar uma parte da letra e exibir o botão **AI Annotation**. Você pode pedir uma explicação sobre o trecho selecionado.

![Trecho de uma letra em japonês selecionado, com o botão AI Annotation visível](docs/screenshots/lyric-selection.png)

### Escolha como conectar a IA

Em **Configurações → IA**, escolha entre CLI, chave de API e modelo local. Na aba CLI, você pode verificar as ferramentas instaladas, configurar o modelo e a pesquisa na web e testar a conexão.

![Configurações de IA com abas de CLI, chave de API e modelo local, além da seleção de modelo e do teste de conexão do Codex CLI](docs/screenshots/ai-settings.png)

## Principais funções

| Função | Descrição |
| --- | --- |
| **Detecção da música em reprodução** | Obtém os dados da música, a capa do álbum e o estado de reprodução dos apps para desktop do Spotify e do Apple Music. |
| **Sincronização de letras** | Destaca o trecho atual e rola a letra automaticamente quando ela inclui marcações de tempo. |
| **Tradução de letras por IA** | Permite ler o original e a tradução juntos, além de pesquisar e selecionar o idioma da tradução. |
| **AI Annotation** | Acrescenta explicações curtas sobre nomes próprios e referências culturais desconhecidas nas letras. Você também pode ajustar a densidade das anotações. |
| **Explicação do trecho selecionado** | Selecione parte da letra para pedir explicações sobre nuances de expressão, jogos de palavras e contexto. |
| **Escolha da conexão de IA** | Você pode usar uma CLI, uma chave de API ou um LLM local. Consulte a [tabela de opções de conexão](#ai-connection-options) abaixo para mais detalhes. |
| **Complementação com pesquisa** | Nas conexões de API e CLI compatíveis, você pode configurar o uso de pesquisa na web nos pedidos de tradução ou explicação. |
| **Cache de traduções** | Recupera traduções salvas de acordo com a música e o idioma. |
| **Atualizações no app** | Em versões de lançamento com atualizações configuradas, você pode verificar e instalar novas versões nas configurações. |

A interface do app está disponível em coreano, inglês, japonês, espanhol, francês, alemão, português do Brasil e chinês simplificado. **O idioma da interface e o idioma de tradução das letras podem ser configurados separadamente.**

## Download

Confira os instaladores para seu sistema operacional e sua CPU em [GitHub Releases](https://github.com/kjsuo/songdocent/releases). Se o instalador ainda não estiver disponível, você pode [executar a partir do código-fonte](#development).

| Ambiente | Destino de distribuição | Formato de instalação |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | Instalador NSIS `.exe` |

**Windows beta:** A versão para Windows ainda não foi testada suficientemente. Alguns recursos podem não funcionar como esperado. Relate os problemas encontrados.

A configuração atual de distribuição usa assinatura ad-hoc no macOS e não inclui notarização da Apple. Se o app baixado for bloqueado, verifique sua origem e use **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**. O instalador do Windows também não tem assinatura de código.

<a id="getting-started"></a>

## Primeiros passos

1. **Reproduza uma música no app para desktop do Spotify ou do Apple Music.**
2. **Abra o SongDocent e selecione o idioma do app.**
3. **Conecte um provedor de letras.** Selecione Spotify ou Apple Music e siga as instruções de conexão no app. A autenticação ocorre em uma janela de login separada. Se a conexão automática não funcionar, use as instruções de entrada manual nas configurações avançadas.
4. **Configure um provedor de IA.** Nas configurações, escolha entre chave de API, CLI e modelo local. Para usar uma CLI, instale a ferramenta e faça login pelo terminal. Depois, faça uma nova busca no app e teste a conexão. Para usar uma API, informe sua própria chave. Para um modelo local, defina o endereço do servidor e o modelo do Ollama ou do LM Studio.
5. **Escolha o idioma da tradução e conclua a configuração.** Quando a música e a letra aparecerem, execute **Traduzir**. Selecione os trechos que deseja entender e peça uma explicação.

Os preços, os limites de uso e os modelos disponíveis para APIs e CLIs dependem do provedor escolhido, do método de autenticação da conta e do plano. Ao usar uma CLI, os pedidos também são enviados ao serviço de IA configurado na ferramenta. A qualidade e a velocidade dos modelos locais variam de acordo com o modelo e as especificações do computador.

<a id="ai-connection-options"></a>

### Opções de conexão de IA

| Tipo de conexão | Ferramentas e provedores compatíveis | O que preparar |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | A CLI instalada no computador e o login ou a autenticação do provedor configurados na ferramenta |
| Chave de API | Gemini, OpenAI, Claude | Sua própria chave de API e o modelo a usar |
| Chave de API | API compatível com OpenAI | URL base do serviço, nome do modelo e chave de API, se necessária |
| Modelo local | Ollama | Servidor Ollama em execução, nome do modelo instalado e endereço do servidor |
| Modelo local | LM Studio | Servidor LM Studio em execução, modelo carregado e endereço do servidor |

### Conecte uma CLI

1. Siga as instruções oficiais da CLI que deseja usar para instalar a ferramenta e fazer login pelo terminal. Você também pode abrir as instruções de instalação e login na lista de **CLIs disponíveis para instalação** no app.
2. Em **Configurações → IA → CLI**, clique em **Buscar novamente** e selecione uma CLI instalada.
3. Selecione um modelo. A opção **Padrão da CLI** usa o modelo padrão da ferramenta. Você pode digitar o nome de um modelo que não esteja na lista.
4. Clique em **Testar conexão**. O teste envia um pedido real com as configurações selecionadas e pode consumir a cota da sua conta. Repita o teste se mudar o modelo ou a configuração de pesquisa na web.

Se a CLI não aparecer, informe o caminho em **Avançado: caminho do executável** e faça uma nova busca. A instalação e o login são feitos no terminal. O SongDocent executa a CLI conectada para solicitar traduções e anotações.

| CLI | Instruções de instalação | Instruções de login |
| --- | --- | --- |
| Codex CLI | [Instalação](https://developers.openai.com/codex/cli/) | [Autenticação](https://developers.openai.com/codex/auth/) |
| Claude Code | [Instalação](https://code.claude.com/docs/en/setup) | [Autenticação](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [Instalação](https://geminicli.com/docs/get-started/installation/) | [Autenticação](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [Instalação](https://antigravity.google/docs/cli/install/) | [Autenticação](https://antigravity.google/docs/install/) |
| OpenCode | [Instalação](https://opencode.ai/docs/) | [Conexão com provedores](https://opencode.ai/docs/providers/) |

A pesquisa na web está disponível em conexões de API e CLI que oferecem essa função. Se você ativar a pesquisa na CLI, use o teste de conexão para verificar seu funcionamento e a presença de fontes. Os modelos e as funções de pesquisa disponíveis variam de acordo com a versão da CLI e a conta. Pedidos de tradução ou anotação podem falhar se o formato da resposta não for o esperado.

## Dados e informações da conta

- **Armazenamento de credenciais:** as chaves de API e os dados de sessão dos serviços de letras são salvos no macOS Keychain ou no Windows Credential Manager.
- **Autenticação da CLI:** a conexão usa a configuração de autenticação existente da ferramenta. O login é feito no terminal, e não é necessário informar uma chave de API separada no SongDocent. As configurações de cada ferramenta determinam como a própria CLI trata as credenciais e o histórico de pedidos.
- **Conexão com os serviços de letras:** usa o valor de sessão `sp_dc` do Spotify ou `media-user-token` do Apple Music. Na conexão automática, o código Rust valida e armazena esses valores e envia apenas o estado da conexão à interface.
- **Envio de pedidos:** os pedidos de letras enviam os dados de sessão ao serviço de letras selecionado. Ao executar uma tradução ou explicação, a letra, os dados da música e o contexto necessário ao pedido são enviados ao provedor de API escolhido, ao serviço de IA configurado na CLI ou ao servidor que você configurou. A conexão com o serviço de letras exige acesso à rede mesmo quando você usa uma IA local.
- **Cache local:** as traduções ficam em arquivos de cache no dispositivo. Esses arquivos são gerenciados separadamente do armazenamento de credenciais.
- **Servidores próprios:** o SongDocent não opera um servidor próprio para coletar cookies de sessão dos serviços de letras.

> **A integração de letras é uma função não oficial.** O SongDocent não é um produto oficial do Spotify nem da Apple, e a conexão de letras não é uma integração com APIs oficiais. Mudanças nos serviços podem interromper seu funcionamento, e as políticas dos provedores podem resultar em restrição ou suspensão da conta. Leia os avisos na tela de conexão antes de usar a função.

As traduções e explicações por IA podem conter erros. O uso de pesquisa também não garante a precisão dos resultados. A disponibilidade das letras e da sincronização de tempo varia de acordo com a música e o provedor.

<a id="development"></a>

## Desenvolvimento

### Pré-requisitos

- Node.js 22 LTS
- pnpm — use a versão especificada em `packageManager` no `package.json`
- Rust stable
- **macOS:** Xcode Command Line Tools
- **Windows:** carga de trabalho de desenvolvimento para desktop com C++ do Visual Studio Build Tools, ferramentas MSVC e WebView2

### Execute a partir do código-fonte

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

Para desenvolver apenas a interface do frontend, use o comando abaixo.

```sh
pnpm run dev
```

O servidor de desenvolvimento abre em `http://127.0.0.1:1420`. Verifique as funções do Tauri, como integração nativa com os players e armazenamento de credenciais, no app para desktop.

### Verificação

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

Os testes de unidade e de componentes e a verificação do build são distintos da validação do login real no Spotify e no Apple Music, da autenticação e dos pedidos de CLI, das permissões do sistema operacional e do comportamento nativo de reprodução. Antes da distribuição pública, verifique o fluxo real de login e a conexão da CLI que você pretende usar no macOS e no Windows, com contas dedicadas a testes.

### Build

```sh
pnpm run tauri build
```

A configuração adequada ao sistema host atual é selecionada automaticamente.

| Plataforma | Integração nativa | Configuração do pacote |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### Estrutura do projeto

```text
src/
  App.tsx                  Telas de letras, tradução e player
  SettingsModal.tsx        Configurações de IA, letras e idioma
  ai/                      Tipos de conexão de IA, detecção de CLI e testes de conexão
  setup/                   Configuração inicial e instruções de conexão
  platform/                Textos e instruções específicos de cada sistema operacional
src-tauri/
  src/
    player.rs              Comandos comuns dos players
    player_macos.rs        Integração com os players do macOS
    player_windows.rs      Integração com os players do Windows
    lyrics.rs              Obtenção de letras
    translation.rs         Tradução e explicação por IA
    cli_ai/                Detecção, execução e processamento de respostas de CLI
    grounding.rs           Complementação com pesquisa
    cache.rs               Cache local de traduções
    secrets.rs             Armazenamento de credenciais do sistema operacional
    provider_connection.rs Conexão de login dos serviços de letras
    app_updates.rs         Atualizações do app
.github/workflows/         Automação de verificações, instaladores e lançamentos
```

## Atualizações

O app de lançamento verifica se há atualizações após iniciar. Você também pode verificar, baixar, instalar e reiniciar manualmente em **Configurações → Atualizações**. A instalação e a reinicialização ocorrem depois que as traduções ou explicações em andamento terminam. No macOS, o app orienta a reinicialização após a instalação. No Windows, o instalador foi projetado para fechar e reiniciar o app, mas esse comportamento ainda não foi testado suficientemente.

## Contribuições e relatos de problemas

Envie bugs e sugestões de melhoria em [Issues](https://github.com/kjsuo/songdocent/issues). Ao relatar um bug, inclua o sistema operacional, a versão do app, o app de música, o provedor de IA, as etapas para reproduzir o problema e os comportamentos esperado e observado.

Para dúvidas gerais e problemas de segurança que não podem ser divulgados publicamente, entre em contato pelo endereço [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com). Ao relatar problemas de conexão com CLI, inclua também o nome e a versão da ferramenta.

Não publique logs ou capturas de tela que contenham dados pessoais, como chaves de API, cookies de sessão e endereços de e-mail. Ao propor alterações no código, inclua os resultados dos testes e builds relacionados.

## Licença

[GNU AGPL v3.0 only (AGPL-3.0-only)](LICENSE). Recursos externos incluídos, como fontes e ícones, têm suas próprias licenças. Consulte os avisos em [Licença das fontes](public/fonts/Geist-LICENSE.txt), [Informações sobre os logotipos dos provedores](public/provider-logos/README.md) e [Outras licenças](public/licenses/).
