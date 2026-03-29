# Windows Optimizer - Product Requirements Document (PRD)

**Projeto:** Windows Optimizer
**Versao:** 1.1.0
**Data:** 2026-03-29
**Autor:** Morgan (PM Agent) com base no estudo de viabilidade de Atlas (Analyst)
**Status:** Draft
**Stakeholder:** Italo Gustavo (Owner/Sole User)

---

## 1. Goals and Background Context

### 1.1 Goals

- Criar um aplicativo desktop leve e performatico para otimizacao e monitoramento do Windows, para uso pessoal
- Oferecer limpeza abrangente de cache do sistema e GPU (shader caches NVIDIA, AMD, DirectX) em uma unica ferramenta
- Monitorar hardware em tempo real incluindo temperaturas de CPU, GPU, disco e placa-mae com alertas visuais
- Centralizar funcionalidades que hoje requerem multiplas ferramentas (CCleaner + HWiNFO + O&O ShutUp10 + Task Manager) em um unico app
- Garantir que o proprio app de otimizacao seja ultra-leve (< 50 MB RAM, < 10 MB instalador)
- Servir como projeto de aprendizado e dominio da stack Tauri 2.x + Rust

### 1.2 Background Context

O estudo de viabilidade (`docs/research/windows-optimizer-app-study.md`) validou que o mercado de PC cleaner software e de USD 1.83 bilhoes (2026), com nenhum concorrente oferecendo limpeza dedicada de cache GPU. A decisao de stack foi Tauri 2.x + Rust (backend) + React/TypeScript (frontend), pontuando 9.2/10 na matriz comparativa, com RAM idle de 30-40 MB e instalador de ~3-5 MB. Todas as APIs Windows necessarias possuem crates Rust maduros (windows, wmi, nvml-wrapper, winreg, sysinfo).

Este e um projeto pessoal do Italo para uso proprio. Nao ha requisitos de modelo de negocio, pricing, code signing, distribuicao publica ou Microsoft Store. O foco e 100% nas funcionalidades tecnicas e na qualidade da experiencia de uso.

### 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-29 | 1.0.0 | PRD inicial baseado no estudo de viabilidade | Morgan (PM) |
| 2026-03-29 | 1.1.0 | Incorporacao de descobertas da pesquisa de foruns (Developer Mode, Gaming Mode, Modo Portable, Honest UI, constraints adicionais, riscos atualizados) | Morgan (PM) |

---

## 2. Personas

### Persona Unica: Italo Gustavo

- **Perfil:** Power user Windows, gamer, desenvolvedor
- **Maquina:** Desktop Windows 11, GPU NVIDIA (principal), possivelmente AMD secundaria
- **Necessidades:** Maximizar performance do sistema, controlar telemetria, monitorar temperaturas durante gaming/dev, limpar caches periodicamente sem abrir multiplas ferramentas
- **Expectativas:** Interface dark mode moderna, operacoes rapidas, sem bloatware, controle total sobre o que cada acao faz
- **Nivel tecnico:** Avancado — quer detalhes tecnicos, nao apenas "otimizar com 1 click"

---

## 3. Requisitos Funcionais

### Modulo 1: Limpeza de Cache do Sistema

**FR-001:** O sistema deve escanear e exibir o tamanho total de arquivos temporarios do usuario (`%TEMP%`) antes da limpeza.
- AC: Ao selecionar scan, exibe lista de categorias com tamanho em MB/GB. Usuario confirma antes de deletar.

**FR-002:** O sistema deve limpar arquivos temporarios do Windows (`C:\Windows\Temp`) com elevacao de privilegios.
- AC: Requer UAC admin. Exibe contagem de arquivos e espaco a liberar. Arquivos em uso sao ignorados silenciosamente (logged).

**FR-003:** O sistema deve limpar o cache do Windows Update (`%WINDIR%\SoftwareDistribution\Download\`).
- AC: Requer elevacao admin. Exibe espaco a liberar. Se o servico Windows Update estiver rodando, avisa o usuario e oferece parar o servico temporariamente.

**FR-004:** O sistema deve limpar arquivos Prefetch (`%WINDIR%\Prefetch\`).
- AC: Requer elevacao admin. Informa que o primeiro boot apos limpeza pode ser mais lento.

**FR-005:** O sistema deve limpar o cache de thumbnails (`%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache_*`).
- AC: Exibe espaco a liberar. Informa que thumbnails serao regenerados sob demanda.

**FR-006:** O sistema deve limpar cache dos browsers Chrome, Edge, Opera e Firefox.
- AC: Detecta automaticamente quais browsers estao instalados. Para cada browser detectado, exibe espaco do cache. Se o browser estiver aberto, avisa que deve ser fechado ou que arquivos em uso serao ignorados. Paths suportados:
  - Chrome: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache\`
  - Edge: `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache\`
  - Firefox: `%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*\cache2\`
  - Opera: `%APPDATA%\Opera Software\Opera Stable\Cache\`

**FR-007:** O sistema deve fazer flush do cache DNS via `ipconfig /flushdns`.
- AC: Requer elevacao admin. Exibe confirmacao de sucesso ou erro.

**FR-008:** O sistema deve limpar o cache do Windows Installer de forma segura (`%WINDIR%\Installer\$PatchCache$\`).
- AC: Requer elevacao admin. Aviso claro de que isso pode afetar uninstalls futuros. Confirmacao extra antes de executar.

**FR-009:** O sistema deve limpar a lista de arquivos recentes (Recent files list) via Registry e Shell.
- AC: Remove entradas de Recent do Explorer. Nao deleta os arquivos reais, apenas as referencias.

**FR-010:** O sistema deve esvaziar a Lixeira (Recycle Bin) via Shell API.
- AC: Exibe espaco total na lixeira. Pede confirmacao. Usa SHEmptyRecycleBin API.

**FR-011:** O sistema deve permitir selecionar individualmente quais categorias de cache limpar antes de executar.
- AC: Interface com checkboxes por categoria. "Select All" e "Deselect All" disponiveis. Cada categoria mostra espaco estimado.

### Modulo 2: Limpeza de Cache GPU

**FR-012:** O sistema deve detectar automaticamente a GPU instalada (NVIDIA, AMD, Intel, ou multiplas).
- AC: Usa NVML para NVIDIA, WMI para AMD/Intel. Exibe nome do modelo, driver version, VRAM.

**FR-013:** O sistema deve limpar shader cache NVIDIA (DXCache, GLCache, NV_Cache).
- AC: Paths limpos:
  - `%LOCALAPPDATA%\NVIDIA\DXCache\`
  - `%LOCALAPPDATA%\NVIDIA\GLCache\`
  - `%LOCALAPPDATA%\NVIDIA Corporation\NV_Cache\`
  Exibe espaco total antes. Nao requer elevacao.

**FR-014:** O sistema deve limpar shader cache AMD (DxCache, GLCache).
- AC: Paths limpos:
  - `%LOCALAPPDATA%\AMD\DxCache\`
  - `%LOCALAPPDATA%\AMD\GLCache\`
  Exibe espaco total antes. Nao requer elevacao.

**FR-015:** O sistema deve limpar DirectX shader cache (`%LOCALAPPDATA%\D3DSCache\`).
- AC: Funciona independente da GPU. Exibe espaco antes. Nao requer elevacao.

**FR-016:** O sistema deve exibir estimativa de espaco a liberar para cada tipo de cache GPU antes da limpeza.
- AC: Scan mostra tabela: [Tipo Cache | Path | Tamanho | Status]. Total no final.

**FR-017:** O sistema deve informar que loading times de jogos podem aumentar temporariamente apos limpeza de shader cache.
- AC: Aviso visual (nao-bloqueante) antes da limpeza de GPU cache.

### Modulo 3: Otimizacao de Servicos Windows

**FR-018:** O sistema deve escanear e listar todos os servicos Windows com classificacao de seguranca: Essencial, Opcional, Inutiл.
- AC: Usa WMI Win32_Service. Cada servico mostra: nome, display name, status (Running/Stopped), startup type (Auto/Manual/Disabled), classificacao de seguranca (verde/amarelo/vermelho), descricao.

**FR-019:** O sistema deve categorizar servicos como SAFE (telemetria: DiagTrack, dmwappushservice), CAUTION (Print Spooler, Bluetooth, Xbox), e DANGEROUS (Windows Update, Defender, RPC).
- AC: Servicos DANGEROUS nao podem ser desativados pelo app. Servicos CAUTION exigem confirmacao extra. Servicos SAFE podem ser desativados livremente.

**FR-020:** O sistema deve oferecer presets de otimizacao de servicos: "Gamer", "Developer", "Minimal", "Default".
- AC: Cada preset define quais servicos desativar/ativar. Ao selecionar preset, exibe diff (o que vai mudar). Usuario confirma antes de aplicar.

**FR-021:** O sistema deve desativar servicos de telemetria Microsoft (DiagTrack, Connected User Experience, etc.).
- AC: Requer elevacao admin. Lista especifica de servicos de telemetria. Pode desativar individualmente ou em grupo.

**FR-022:** O sistema deve desativar servicos legados (NetBIOS, Fax, MapsBroker, RetailDemo, etc.).
- AC: Lista curada de servicos legados com descricao do que cada um faz. Requer elevacao.

**FR-023:** O sistema deve fazer backup completo da configuracao atual de servicos antes de qualquer modificacao.
- AC: Salva estado de todos os servicos (nome, startup type, status) em arquivo JSON/YAML timestamped. Multiplos backups mantidos.

**FR-024:** O sistema deve restaurar configuracao de servicos a partir de qualquer backup salvo.
- AC: Lista backups disponiveis com data/hora. Ao restaurar, exibe diff do que vai mudar. Requer elevacao admin.

**FR-025:** Todas as operacoes de servicos devem requerer elevacao de privilegios (Admin).
- AC: Se o app nao estiver rodando como admin, solicita elevacao UAC antes de executar operacoes de servicos.

### Modulo 4: Gerenciador de Inicializacao

**FR-026:** O sistema deve listar todos os programas de startup de todas as fontes: Registry (Run/RunOnce HKCU e HKLM), Startup folder, e Task Scheduler (logon triggers).
- AC: Tabela unificada: [Nome | Fonte | Path | Status (Ativo/Inativo) | Impacto Estimado]. Fontes listadas:
  - `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
  - `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
  - `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce`
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
  - Task Scheduler (logon triggers)

**FR-027:** O sistema deve permitir habilitar/desabilitar cada item de startup individualmente.
- AC: Toggle por item. Requer elevacao para itens HKLM e Task Scheduler. Alteracao imediata (sem necessidade de reboot para aplicar, mas efeito so no proximo login).

**FR-028:** O sistema deve estimar o impacto de cada item de startup em RAM e tempo de boot.
- AC: Para RAM: usa WMI para verificar working set do processo correspondente se estiver rodando. Para tempo: classifica como Low/Medium/High baseado em heuristica (tipo de app, tamanho do executavel).

**FR-029:** O sistema deve manter historico de mudancas feitas no startup.
- AC: Log persistente com: [Data/Hora | Item | Acao (Enable/Disable) | Fonte]. Visualizavel no app.

### Modulo 5: Otimizacao de RAM

**FR-030:** O sistema deve fazer flush de working sets de processos idle.
- AC: Usa SetProcessWorkingSetSize/EmptyWorkingSet. Nao aplica em processos do sistema (PID < 10 ou processos criticos). Aviso claro de que pode causar lentidao temporaria. Requer elevacao admin.

**FR-031:** O sistema deve limpar a standby list do sistema.
- AC: Usa RAMMap-style cleanup ou EmptyWorkingSet em processos idle. Exibe MB liberados apos operacao.

**FR-032:** O sistema deve monitorar e listar processos pesados ordenados por uso de RAM.
- AC: Tabela: [Processo | PID | RAM (Working Set) | RAM (Private) | CPU%]. Atualiza a cada 2-5 segundos. Top 20 por default.

**FR-033:** O sistema deve permitir matar processos por PID.
- AC: Seleciona processo da lista, confirma kill. Processos do sistema protegidos (aviso + confirmacao extra). Usa TerminateProcess API.

### Modulo 6: Otimizacao de Disco

**FR-034:** O sistema deve detectar automaticamente o tipo de cada disco instalado (SSD vs HDD) via WMI.
- AC: Exibe lista de discos: [Drive Letter | Modelo | Tipo (SSD/HDD) | Capacidade | Espaco Livre | Health].

**FR-035:** O sistema deve executar TRIM manual em SSDs selecionados.
- AC: Usa IOCTL_STORAGE_MANAGE_DATA_SET_ATTRIBUTES. Requer elevacao admin. Apenas disponivel para discos detectados como SSD.

**FR-036:** O sistema deve executar desfragmentacao em HDDs selecionados.
- AC: Usa `defrag.exe` CLI ou Optimize-Volume PowerShell. Requer elevacao admin. Nao disponivel para SSDs (aviso se tentar). Exibe progresso.

**FR-037:** O sistema deve oferecer analise visual de espaco em disco (treemap).
- AC: Scan recursivo do disco selecionado. Exibe treemap interativo mostrando pastas/arquivos por tamanho. Permite navegar dentro de pastas.

**FR-038:** O sistema deve detectar arquivos grandes (> threshold configuravel, default 100 MB).
- AC: Scan lista: [Path | Tamanho | Ultima Modificacao]. Ordenavel por tamanho. Permite abrir local no Explorer.

**FR-039:** O sistema deve detectar arquivos duplicados por hash comparison.
- AC: Scan por hash (SHA-256 ou similar). Agrupa duplicados. Exibe espaco desperdicado. Permite selecionar quais manter. Confirmacao antes de deletar.

### Modulo 7: Monitoramento de Sistema (Dashboard)

**FR-040:** O sistema deve monitorar CPU em tempo real: uso percentual total, frequencia atual, e uso por core individual.
- AC: Graficos de linha atualizando a cada 1-2 segundos. Exibe: % total, MHz por core, numero de cores/threads.

**FR-041:** O sistema deve monitorar RAM em tempo real: uso total, disponivel, cached, e paginada.
- AC: Usa GlobalMemoryStatusEx. Exibe: barra de uso, GB usada/total, cached, commit charge.

**FR-042:** O sistema deve monitorar GPU em tempo real: uso percentual, VRAM utilizada, e clock speed.
- AC: NVIDIA via NVML: GPU utilization %, memory utilization %, clock speeds (core/memory). AMD via ADL SDK (FFI) ou WMI fallback.

**FR-043:** O sistema deve monitorar disco em tempo real: velocidade de leitura/escrita e IOPS.
- AC: Usa Performance Counters (PDH). Exibe: MB/s leitura, MB/s escrita, IOPS. Por disco fisico.

**FR-044:** O sistema deve monitorar rede em tempo real: upload e download speed.
- AC: Usa Performance Counters ou GetIfTable2. Exibe: KB/s ou MB/s upload/download. Por interface de rede ativa.

**FR-045:** O sistema deve monitorar temperaturas de CPU, GPU, disco (NVMe/HDD) e placa-mae.
- AC: Fontes de temperatura:
  - CPU: WMI MSAcpi_ThermalZoneTemperature (requer admin) ou sysinfo crate
  - GPU NVIDIA: NVML (nvmlDeviceGetTemperature)
  - GPU AMD: ADL SDK ou WMI
  - Disco NVMe: S.M.A.R.T. via WMI ou DeviceIoControl
  - Placa-mae: WMI thermal zones
  Exibe em Celsius. Atualiza a cada 2 segundos.

**FR-046:** O sistema deve exibir alertas visuais quando temperaturas ultrapassarem thresholds configuraveis.
- AC: Thresholds default: CPU 85C, GPU 90C, Disco 60C, Placa-mae 80C. Alerta visual (borda vermelha pulsante, icone de alerta). Thresholds configuraveis pelo usuario.

**FR-047:** O sistema deve manter historico de temperaturas com grafico temporal.
- AC: Armazena leituras de temperatura em buffer local (ultimas 24h). Grafico de linha temporal por sensor. Permite zoom in/out. Exporta CSV opcional.

**FR-048:** O sistema deve exibir espaco em disco por drive: total, usado, livre.
- AC: Barra visual por drive. Cores indicam nivel de uso (verde < 70%, amarelo 70-90%, vermelho > 90%).

### Modulo 8: Presets e Automacao

**FR-049:** O sistema deve oferecer presets globais salvos: "Gamer", "Developer", "Streaming", "Minimal".
- AC: Cada preset combina configuracoes de: servicos, startup, e tipos de limpeza. Preset exibe descricao e lista do que faz antes de aplicar.

**FR-050:** O sistema deve permitir agendar limpeza automatica em intervalos configuraveis.
- AC: Opcoes: diario, semanal, mensal, ou custom (cron-style). Selecao de quais modulos executar. Executa em background. Gera log de cada execucao.

**FR-051:** O sistema deve permitir criar perfis customizados que combinam servicos + startup + limpeza.
- AC: Interface de criacao de perfil: nome, selecao de servicos, selecao de startup, selecao de caches. Salva em arquivo local. Import/export de perfis.

**FR-052:** O sistema deve oferecer funcao "One-Click Optimize" que executa todas as otimizacoes selecionadas.
- AC: Botao unico que roda: limpeza de caches selecionados + limpeza GPU cache + otimizacao de servicos (preset ativo) + flush RAM. Exibe progresso por etapa. Resumo final com espaco liberado, servicos alterados, tempo gasto.

### Modulo 9: Developer Mode — Limpeza de Caches de Desenvolvimento

> **Fonte:** Pesquisa de foruns (`docs/research/user-needs-forum-research.md`, secao 2.5.1). Evidencia: GitHub tools (clear-dev-caches-win, WSL-CleanUp, Professional Cache Cleanup Tool), blog khides.com. Nenhum app oferece esta funcionalidade de forma integrada. Espaco recuperavel estimado: 30-150GB em maquinas de desenvolvedor tipicas.

**FR-053:** O sistema deve detectar automaticamente quais ferramentas de desenvolvimento estao instaladas na maquina.
- AC: Detecta presenca de: Node.js (npm/pnpm/yarn), Python (pip), Rust (cargo), Go, Java (Maven/Gradle), Docker, WSL2, VS Code, JetBrains IDEs. Deteccao via verificacao de executaveis no PATH e paths conhecidos. Exibe lista de ferramentas detectadas com versao quando disponivel.

**FR-054:** O sistema deve escanear e listar pastas `node_modules` orfas — projetos sem `package.json` pai ativo ou sem modificacao recente (threshold configuravel, default 90 dias).
- AC: Scan recursivo a partir de diretorios configurados pelo usuario (default: `%USERPROFILE%\Projects`, `%USERPROFILE%\Documents`). Para cada `node_modules` encontrado, verifica: existencia de `package.json` no pai, data de ultima modificacao do projeto. Exibe: [Path | Tamanho | Ultima Modificacao | Status (Orfao/Inativo/Ativo)]. Permite selecao individual para limpeza.

**FR-055:** O sistema deve limpar cache global de package managers JavaScript (npm, yarn, pnpm).
- AC: Paths limpos:
  - npm: `%APPDATA%\npm-cache\`
  - yarn: `%LOCALAPPDATA%\Yarn\Cache\`
  - pnpm: `%LOCALAPPDATA%\pnpm-store\` e `%LOCALAPPDATA%\pnpm\store\`
  Detecta quais estao instalados. Exibe espaco por package manager. Apenas limpa os que existem.

**FR-056:** O sistema deve limpar Docker images, volumes e build cache nao utilizados.
- AC: Executa equivalente a `docker system prune` via Docker CLI (requer Docker instalado e rodando). Exibe preview de: images dangling, volumes nao referenciados, build cache. Espaco total a liberar. Confirmacao antes de executar. Se Docker nao estiver instalado/rodando, feature desabilitada com mensagem informativa.

**FR-057:** O sistema deve oferecer compactacao de discos virtuais WSL2 (vhdx).
- AC: Detecta distribuicoes WSL2 instaladas via `wsl --list`. Para cada distribuicao, localiza o arquivo `ext4.vhdx`. Exibe: tamanho atual do vhdx vs espaco real utilizado (estimativa). Executa `wsl --shutdown` + `Optimize-VHD` (PowerShell) ou `diskpart` para compactar. Aviso de que WSL2 sera desligado durante o processo. Requer elevacao admin.

**FR-058:** O sistema deve limpar cache de pip (Python).
- AC: Path: `%LOCALAPPDATA%\pip\Cache\`. Detecta se Python/pip esta instalado. Exibe espaco do cache. Nao requer elevacao.

**FR-059:** O sistema deve limpar cache de cargo (Rust).
- AC: Path: `%USERPROFILE%\.cargo\registry\cache\` e `%USERPROFILE%\.cargo\registry\src\`. Detecta se Rust/cargo esta instalado. Exibe espaco por subdiretorio (cache vs src vs git). Nao requer elevacao.

**FR-060:** O sistema deve limpar cache de Go modules.
- AC: Path: `%GOPATH%\pkg\mod\` (default: `%USERPROFILE%\go\pkg\mod\`). Detecta se Go esta instalado. Exibe espaco. Nao requer elevacao.

**FR-061:** O sistema deve limpar cache de Maven e Gradle (Java).
- AC: Paths:
  - Maven: `%USERPROFILE%\.m2\repository\`
  - Gradle: `%USERPROFILE%\.gradle\caches\`
  Detecta quais estao instalados. Exibe espaco por cache. Nao requer elevacao.

**FR-062:** O sistema deve exibir estimativa total de espaco recuperavel antes de executar qualquer limpeza de caches de desenvolvimento.
- AC: Scan de todos os caches detectados. Tabela consolidada: [Categoria | Ferramenta | Path | Tamanho | Status]. Total geral no final. Permite selecao individual por categoria. "Select All" e "Deselect All" disponiveis.

### Modulo 10: Gaming Mode — Preset One-Click para Gaming

> **Fonte:** Pesquisa de foruns (`docs/research/user-needs-forum-research.md`, secoes 2.4.1 e 2.4.2). Evidencia: Reddit r/pcmasterrace (threads regulares), Razer Cortex (1M+ downloads apesar de reclamacoes de peso), Hone.gg (1M+ gamers). Problema atual: Windows Game Mode e limitado, Razer Cortex adiciona overhead, "FPS Boosters" sao teatro. Impacto reportado por gamers: 10-15% CPU e 500MB-1GB RAM liberados com otimizacao de servicos.

**FR-063:** O sistema deve oferecer um botao "Ativar Gaming Mode" que executa todas as otimizacoes gaming em uma unica acao.
- AC: Botao toggle proeminente. Ao ativar: salva snapshot do estado atual do sistema (servicos rodando, processos, prioridades) para restauracao posterior. Exibe lista do que sera feito antes de confirmar.

**FR-064:** O Gaming Mode deve desligar servicos desnecessarios para gaming.
- AC: Servicos desligados temporariamente: DiagTrack (telemetria), Windows Search (indexacao), SysMain/Superfetch (controverso mas pedido), Connected User Experiences, Downloaded Maps Manager, Print Spooler (se nao houver impressora ativa). Lista configuravel pelo usuario. Nao desliga servicos classificados como DANGEROUS (FR-019).

**FR-065:** O Gaming Mode deve limpar GPU shader cache antes da sessao de gaming.
- AC: Executa limpeza de shader caches (NVIDIA/AMD/DirectX conforme FR-013 a FR-015). Opcional (toggle habilitado por default). Aviso de que primeiros minutos de jogo podem ter stuttering por recompilacao de shaders.

**FR-066:** O Gaming Mode deve fazer flush de RAM (working sets de processos idle).
- AC: Executa FR-030 (flush working sets) de forma automatica. Aplica apenas em processos nao-essenciais. Exibe MB liberados no resumo.

**FR-067:** O Gaming Mode deve permitir configurar prioridade de processo do jogo para HIGH.
- AC: Opcao de selecionar o executavel (.exe) do jogo. Ao detectar que o processo do jogo esta rodando, seta prioridade para HIGH via SetPriorityClass API. Aviso de que prioridade REALTIME nao e oferecida (risco de travamento). Configuracao salva por jogo.

**FR-068:** O Gaming Mode deve restaurar TUDO ao ser desativado.
- AC: Ao desativar (botao toggle ou ao fechar o jogo selecionado): restaura servicos ao estado do snapshot salvo em FR-063, restaura prioridades de processo. Log de tudo que foi restaurado. Se o app crashar, na proxima abertura detecta Gaming Mode ativo e oferece restaurar.

**FR-069:** O Gaming Mode deve permitir selecionar o executavel (.exe) do jogo para ativacao automatica.
- AC: Configuracao por jogo: usuario seleciona .exe via file picker. Quando o processo e detectado rodando, Gaming Mode ativa automaticamente. Quando o processo termina, Gaming Mode desativa e restaura. Lista de jogos configurados persistida. Opcional: ativacao manual sem .exe selecionado.

**FR-070:** O Gaming Mode deve desabilitar Game DVR/Xbox Game Bar automaticamente.
- AC: Desabilita via Registry: `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR` (AppCaptureEnabled = 0) e `HKCU\System\GameConfigStore` (GameDVR_Enabled = 0). Restaura valores originais ao desativar Gaming Mode.

---

## 4. Requisitos Nao-Funcionais

**NFR-001:** O app deve consumir menos de 50 MB de RAM em idle (sem monitoramento ativo).
- AC: Medido via Task Manager. Com monitoramento ativo, aceita-se ate 80 MB.

**NFR-002:** O instalador deve ter menos de 10 MB.
- AC: NSIS ou WiX installer. Tauri 2.x base e ~2.5 MB; com assets ~5-8 MB total.

**NFR-003:** A interface deve seguir dark theme com estetica moderna (gamer aesthetic).
- AC: Dark theme como default (e unico tema no MVP). Cores: fundo escuro (#0D1117 ou similar), acentos em azul/cyan/verde neon. Fontes legiveeis (Inter, JetBrains Mono para dados).

**NFR-004:** Todas as operacoes destrutivas devem pedir confirmacao explicita do usuario.
- AC: Dialogo modal com descricao do que sera feito, espaco/itens afetados, e botoes "Confirmar" / "Cancelar". Operacoes DANGEROUS (servicos, kill process) pedem dupla confirmacao.

**NFR-005:** O sistema deve suportar undo/rollback para operacoes de servicos e startup.
- AC: Backup automatico antes de alteracoes. Botao "Desfazer ultima acao" disponivel. Historico de todas alteracoes com opcao de restaurar qualquer ponto.

**NFR-006:** Todas as operacoes devem ser logadas em arquivo persistente.
- AC: Log file em `%APPDATA%\WindowsOptimizer\logs\`. Formato: `[timestamp] [modulo] [acao] [resultado] [detalhes]`. Rotacao de logs (max 50 MB, manter ultimos 30 dias).

**NFR-007:** O app deve funcionar no Windows 10 (build 1809+) e Windows 11.
- AC: Tauri 2.x usa WebView2. Windows 11 tem WebView2 pre-instalado. Windows 10 pode precisar instalar (installer faz auto-detect e instala se necessario).

**NFR-008:** O tempo de startup do app deve ser inferior a 1 segundo.
- AC: Medido do clique ate a janela renderizada. Tauri + Rust target < 500ms.

**NFR-009:** O monitoramento de sistema deve atualizar a cada 1-2 segundos sem impacto perceptivel na performance.
- AC: Thread(s) de monitoramento em Rust (nao na UI thread). Comunicacao via Tauri events. CPU overhead do monitoramento < 1%.

**NFR-010:** O app deve operar em dois modos: normal (usuario) e elevado (admin), com elevacao sob demanda.
- AC: Inicia sem elevacao. Funcoes que requerem admin (servicos, HKLM, TRIM, flush RAM) solicitam UAC quando necessario. Se ja estiver elevado, pula UAC.

**NFR-011:** O app deve funcionar em modo portable (executavel standalone, sem instalacao).
- AC: Gera um executavel unico (.exe) que pode rodar de qualquer diretorio, incluindo pen drive. Configuracoes e logs salvos na pasta do executavel (subfolder `data/`). Nao requer instalacao, nao escreve no Registry para si proprio, nao cria entradas no Programs & Features. Coexiste com versao instalada sem conflito.
- Fonte: Pesquisa de foruns — demanda de usuarios que preferem ferramentas portable para uso em maquinas de terceiros ou em ambientes corporativos com restricoes de instalacao.

**NFR-012:** O app deve seguir o principio de "Honest UI" — sem alarmismo, sem fake urgency, dados reais.
- AC: Nunca exibir icones vermelhos/tristes ou linguagem alarmista quando o sistema esta saudavel. Nunca inflar numeros (ex: "5000 problemas encontrados"). Dashboard mostra estado real do sistema com linguagem neutra e factual. Barras de progresso e metricas refletem valores reais medidos. Se nao ha nada a limpar, exibe "Sistema limpo" com indicador verde neutro (sem animacoes de celebracao excessiva). Evitar "scare tactics" como "Seu PC esta em risco!" para induzir acoes desnecessarias.
- Fonte: Pesquisa de foruns — reclamacao #1 sobre CCleaner ("fake drama", "sad red face even when 100% of apps are sleeping"), IObit ("numeros inflados"), Microsoft PC Manager ("boost que dura 6 min"). Citacao direta Trustpilot: "The 'Performance Optimizer' shows a sad red face even when 100% of the apps in the list are already sleeping. It's fake drama to trick users into buying Pro."

---

## 5. Constraints

**CON-001:** Stack tecnologico fixo: Tauri 2.x + Rust (backend) + React/TypeScript (frontend).
- Justificativa: Validado no estudo de viabilidade com score 9.2/10. Menor footprint de memoria e instalador.

**CON-002:** Sem backend remoto ou cloud. Tudo roda localmente no PC do usuario.
- Justificativa: Projeto pessoal, zero telemetria, zero dependencia de internet.

**CON-003:** Sem model de negocio, pricing, licenciamento ou distribuicao publica.
- Justificativa: Uso pessoal exclusivo do Italo.

**CON-004:** Sem code signing certificate.
- Justificativa: Distribuicao privada apenas. SmartScreen warnings sao aceitaveis para uso pessoal.

**CON-005:** Windows apenas (sem cross-platform).
- Justificativa: Todas as APIs usadas sao exclusivas do Windows (WMI, Win32, NVML, Registry).

**CON-006:** Dependencia de WebView2 runtime no Windows 10.
- Justificativa: Tauri 2.x usa WebView2. O installer deve verificar e instalar se necessario.

**CON-007:** Acesso a temperaturas de CPU via WMI pode requerer sempre elevacao admin.
- Justificativa: MSAcpi_ThermalZoneTemperature exige admin. Alternativas: sysinfo crate, OpenHardwareMonitor lib.

**CON-008:** Monitoramento de GPU AMD depende de ADL SDK com FFI bindings (nao ha crate Rust madura).
- Justificativa: Pode ser implementado em fase posterior (v1.0). MVP foca em NVIDIA (nvml-wrapper).

**CON-009:** NUNCA fazer registry cleaning.
- Justificativa: Microsoft desencoraja oficialmente a pratica. Beneficio de performance e negligivel (microsegundos em lookup). Risco de corromper o sistema e alto. CCleaner Duplicate Finder "bricked all apps" de usuarios (Trustpilot). Microsoft flagou ferramentas de registry cleaning como PUP (Potentially Unwanted Programs). Decisao de design: este app nao toca no Registry exceto para suas proprias configuracoes de servicos/startup (escopo controlado e reversivel).
- Fonte: Pesquisa de foruns, secao 5.1 — "Hall da Vergonha". Microsoft policy on registry cleaners.

**CON-010:** NUNCA fazer "RAM boost" cosmetico (flush de standby list que dura ~6 minutos antes do sistema recarregar).
- Justificativa: Microsoft PC Manager faz isso e e amplamente criticado ("boost dura apenas 6 minutos"). O flush de working sets (FR-030) e oferecido com HONESTIDADE — o app explica que o efeito e temporario e que o OS vai recarregar paginas conforme necessario. Jamais apresentar flush de RAM como "otimizacao permanente" ou "boost de performance". Citacao da pesquisa: "Cleaning RAM does nothing if the game needs real GPU power. Many apps fake optimizing by showing animations."
- Fonte: Pesquisa de foruns, secoes 2.4.1 e 5.2. XDA Developers review do Microsoft PC Manager.

**CON-011:** NUNCA bundlar software de terceiros no instalador ou no app.
- Justificativa: Pratica toxica #1 do mercado de optimizers. IObit instala "half a dozen iTop packages" sem consentimento. CCleaner historicamente bundlava toolbar. Advanced SystemCare classificado como PUP por antivirus devido a bundleware. O instalador do Windows Optimizer contem EXCLUSIVAMENTE o app e suas dependencias diretas (WebView2 runtime se necessario no Windows 10). Zero toolbars, zero "ofertas especiais", zero checkboxes pre-marcados.
- Fonte: Pesquisa de foruns, secoes 2.8 e 5.1. Trustpilot IObit, MalwareTips.

---

## 6. Arquitetura de Alto Nivel

```
+--------------------------------------------------+
|            Windows Optimizer (Tauri 2.x)          |
+--------------------------------------------------+
|                                                    |
|  +----------------------------------------------+ |
|  |  FRONTEND (WebView2)                         | |
|  |  React + TypeScript + Tailwind CSS           | |
|  |  - Dashboard (graficos real-time)            | |
|  |  - Modulos (cache, GPU, servicos, etc.)      | |
|  |  - Settings (thresholds, presets, scheduler)  | |
|  +----------------------------------------------+ |
|         |  Tauri Commands (IPC)  |                 |
|  +----------------------------------------------+ |
|  |  BACKEND (Rust)                              | |
|  |  +------------------+  +------------------+  | |
|  |  | System Module    |  | Monitor Module   |  | |
|  |  | - cache_cleaner  |  | - cpu_monitor    |  | |
|  |  | - gpu_cleaner    |  | - ram_monitor    |  | |
|  |  | - service_mgr    |  | - gpu_monitor    |  | |
|  |  | - startup_mgr    |  | - disk_monitor   |  | |
|  |  | - ram_optimizer  |  | - net_monitor    |  | |
|  |  | - disk_optimizer |  | - temp_monitor   |  | |
|  |  | - dev_cleaner    |  |                  |  | |
|  |  +------------------+  +------------------+  | |
|  |  +------------------+  +------------------+  | |
|  |  | Config Module    |  | Scheduler Module |  | |
|  |  | - presets        |  | - cron_runner    |  | |
|  |  | - profiles       |  | - task_queue     |  | |
|  |  | - backup/restore |  | - log_writer     |  | |
|  |  | - gaming_mode    |  |                  |  | |
|  |  +------------------+  +------------------+  | |
|  +----------------------------------------------+ |
|         |  Windows APIs  |                         |
|  +----------------------------------------------+ |
|  |  OS LAYER                                    | |
|  |  - Win32 API (windows crate)                 | |
|  |  - WMI (wmi crate)                           | |
|  |  - NVML (nvml-wrapper crate)                 | |
|  |  - Registry (winreg crate)                   | |
|  |  - sysinfo crate                             | |
|  |  - Performance Counters (PDH)                | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```

### Crates Rust Essenciais

| Crate | Versao | Uso |
|-------|--------|-----|
| `tauri` | 2.x | Framework principal |
| `windows` | latest | Win32 API bindings (Microsoft oficial) |
| `wmi` | latest | Queries WMI (servicos, hardware, temp) |
| `nvml-wrapper` | 0.9+ | Monitoramento GPU NVIDIA |
| `winreg` | latest | Leitura/escrita Registry |
| `sysinfo` | latest | CPU, RAM, disco, processos |
| `windows-service` | latest | Gerenciamento de servicos |
| `serde` / `serde_json` | latest | Serializacao de configs e backups |
| `chrono` | latest | Timestamps para logs e historico |
| `tokio` | latest | Async runtime para tarefas background |

### Frontend Stack

| Lib | Uso |
|-----|-----|
| React 18+ | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling (dark theme) |
| Recharts ou Tremor | Graficos real-time (CPU, RAM, temp) |
| @tauri-apps/api | IPC com backend Rust |

---

## 7. Modulos e Dependencias

```
Modulo 1: Cache Cleaner ------> [Nenhuma dependencia]
Modulo 2: GPU Cache Cleaner ---> [FR-012: GPU Detection]
Modulo 3: Service Manager ----> [FR-023: Backup System]
Modulo 4: Startup Manager ----> [Nenhuma dependencia]
Modulo 5: RAM Optimizer ------> [FR-032: Process Monitor (Monitor Module)]
Modulo 6: Disk Optimizer -----> [FR-034: Disk Detection]
Modulo 7: System Monitor -----> [Nenhuma dependencia, componente core]
Modulo 8: Presets/Automation -> [Depende de Modulos 1-6 para execucao]
Modulo 9: Developer Mode -----> [FR-053: Dev Tool Detection]
Modulo 10: Gaming Mode -------> [FR-019: Service Classification, FR-013-15: GPU Cache, FR-030: RAM Flush, FR-023: Backup/Snapshot]
```

### Dependencias Cross-Module

| Dependencia | Provider | Consumers |
|-------------|----------|-----------|
| GPU Detection | Modulo 2 (FR-012) | Modulo 7 (GPU monitoring) |
| Process Listing | Modulo 7 (FR-032) | Modulo 5 (RAM optimizer) |
| Disk Detection (SSD/HDD) | Modulo 6 (FR-034) | Modulo 7 (disk monitor) |
| Backup/Restore Engine | Modulo 3 (FR-023) | Modulo 4 (startup history) |
| UAC Elevation Handler | Infraestrutura | Modulos 1-6 |
| Config/Preferences Store | Infraestrutura | Todos os modulos |
| Log Writer | Infraestrutura | Todos os modulos |
| Dev Tool Detection | Modulo 9 (FR-053) | Modulo 9 (todos os FRs de dev cleanup) |
| Service Classification | Modulo 3 (FR-019) | Modulo 10 (Gaming Mode service disable) |
| GPU Cache Cleaner | Modulo 2 (FR-013-015) | Modulo 10 (shader cache pre-gaming) |
| RAM Flush | Modulo 5 (FR-030) | Modulo 10 (Gaming Mode RAM flush) |
| System State Snapshot | Modulo 10 (FR-063) | Modulo 10 (Gaming Mode restore) |

---

## 8. MVP vs Full Scope

### MVP (v0.1) — Estimativa: ~102 Story Points

| Modulo | Features Incluidas | Justificativa |
|--------|--------------------|---------------|
| Cache Cleaner | Temp, browser, prefetch, Update, Recycle Bin | Core value — limpeza basica |
| GPU Cache Cleaner | NVIDIA (DX/GL/NV_Cache), AMD, DirectX | Diferencial principal #1 |
| Developer Mode | node_modules orfaos, npm/pip/cargo/go cache, Docker prune, WSL2 compaction | Diferencial principal #2 — nenhum concorrente oferece. Pesquisa de foruns confirmou alta demanda (20+ tools/scripts no GitHub, 30-150GB recuperaveis). Publico dev e early adopter ideal. |
| Gaming Mode | One-click activate, service disable, shader cache cleanup, RAM flush, process priority, auto-restore | Diferencial de mercado — Razer Cortex tem 1M+ downloads apesar de overhead pesado. Pesquisa de foruns mostrou que gamers querem otimizacao REAL, nao teatro. Incluso no MVP por ser diferencial competitivo forte. |
| System Monitor | CPU, RAM, GPU (NVIDIA), info hardware, temperaturas basicas | Dashboard e a "home" do app |
| UI Shell | Dashboard, navegacao, dark theme, confirmacoes, Honest UI (NFR-012) | Necessario para usar o app. Honest UI e diferencial de marca vs CCleaner/IObit |
| Infraestrutura | Installer, UAC handling, logging, config store | Necessario para funcionar |

### v1.0 (Full Scope) — +136 Story Points adicionais

| Modulo | Features Adicionais |
|--------|---------------------|
| Service Manager | Listar, desativar, presets, restore |
| Startup Manager | Listar, desativar, impacto estimado, historico |
| RAM Optimizer | Flush working set, standby cleanup, kill process |
| Disk Optimizer | TRIM SSD, desfrag HDD, treemap, arquivos grandes/duplicados |
| Monitor (avancado) | AMD GPU, temperaturas completas, disco I/O, network, historico 24h |
| Presets/Automacao | Presets globais, scheduler, perfis custom, one-click optimize |
| Developer Mode (avancado) | Limpeza de caches de IDEs (VS Code, JetBrains), deteccao de projetos dev inativos |
| Gaming Mode (avancado) | Perfis por jogo, overlay leve de FPS/temperatura, deteccao automatica de jogos |
| Modo Portable | Executavel standalone sem instalacao (NFR-011) |

### Exclusoes do MVP (movidas para v1.0)

- Thumbnails cache, DNS cache, Windows Installer cache, Recent files (FR-005, FR-007, FR-008, FR-009)
- Presets de servicos e restauracao (FR-020, FR-024)
- Impacto estimado de startup e historico (FR-028, FR-029)
- Toda a otimizacao de RAM (FR-030, FR-031)
- TRIM, desfrag, treemap, duplicados (FR-035 a FR-039)
- Temperaturas de placa-mae e disco, alertas, historico (parcial FR-045, FR-046, FR-047)
- Network monitoring (FR-044)
- Scheduler e one-click optimize (FR-050, FR-052)

---

## 9. Epics Sugeridos

### Epic 1: Foundation & Tauri Project Setup
**Goal:** Estabelecer a infraestrutura do projeto Tauri 2.x + Rust + React/TS, com CI basico, logging, config store, UAC handling, e uma tela canary funcional.
- Story 1.1: Scaffold Tauri 2.x project com React/TS frontend e Rust backend
- Story 1.2: Configurar dark theme base (Tailwind), layout shell (sidebar + content area), e navegacao entre modulos
- Story 1.3: Implementar sistema de logging persistente (NFR-006) e config store (serde JSON)
- Story 1.4: Implementar UAC elevation handler com deteccao de modo admin
- Story 1.5: Criar installer NSIS basico com deteccao de WebView2

### Epic 2: System Cache Cleaner
**Goal:** Entregar o modulo de limpeza de cache do sistema com scan, preview de espaco, selecao por categoria, e execucao com confirmacao.
- Story 2.1: Implementar scanner de temp files (usuario + Windows) com calculo de tamanho
- Story 2.2: Implementar scanner e limpeza de browser cache (Chrome, Edge, Firefox, Opera)
- Story 2.3: Implementar limpeza de Windows Update cache, Prefetch, e Recycle Bin
- Story 2.4: Implementar UI de selecao por categoria com preview de espaco e confirmacao
- Story 2.5: Integrar todas as limpezas com logging e feedback de progresso

### Epic 3: GPU Cache Cleaner
**Goal:** Entregar o diferencial do app — deteccao automatica de GPU e limpeza de shader caches NVIDIA, AMD e DirectX.
- Story 3.1: Implementar deteccao de GPU via NVML (NVIDIA) e WMI (AMD/Intel)
- Story 3.2: Implementar scan e limpeza de shader caches NVIDIA (DXCache, GLCache, NV_Cache)
- Story 3.3: Implementar scan e limpeza de shader caches AMD e DirectX Shader Cache
- Story 3.4: Implementar UI do modulo GPU com estimativa de espaco e aviso de impacto

### Epic 4: System Monitoring Dashboard
**Goal:** Entregar monitoramento real-time de CPU, RAM, GPU (NVIDIA), temperaturas (CPU/GPU), com graficos e alertas visuais.
- Story 4.1: Implementar monitor de CPU (uso %, frequencia, por core) com Tauri events
- Story 4.2: Implementar monitor de RAM (uso, disponivel, cached, paginada) com visualizacao
- Story 4.3: Implementar monitor de GPU NVIDIA (uso %, VRAM, clock, temperatura) via NVML
- Story 4.4: Implementar monitoramento de temperatura CPU via WMI/sysinfo com alertas visuais
- Story 4.5: Criar dashboard unificado com graficos real-time (Recharts) e layout responsivo

### Epic 5: Windows Service Manager
**Goal:** Entregar gerenciamento de servicos com classificacao de seguranca, presets, desativacao de telemetria, e backup/restore.
- Story 5.1: Implementar scanner de servicos com classificacao (SAFE/CAUTION/DANGEROUS) via WMI
- Story 5.2: Implementar enable/disable de servicos com elevacao admin e confirmacoes
- Story 5.3: Implementar backup e restore de estado de servicos
- Story 5.4: Implementar presets (Gamer, Developer, Minimal, Default) com diff preview
- Story 5.5: Implementar desativacao de telemetria e servicos legados

### Epic 6: Startup Manager & RAM Optimizer
**Goal:** Entregar gerenciamento de inicializacao (Registry + Startup folder + Task Scheduler) e otimizacao basica de RAM.
- Story 6.1: Implementar lister de startup items de todas as fontes (Registry, folder, Task Scheduler)
- Story 6.2: Implementar enable/disable de startup items com historico de mudancas
- Story 6.3: Implementar estimativa de impacto (RAM, tempo de boot) por item
- Story 6.4: Implementar monitoramento de processos pesados e kill por PID
- Story 6.5: Implementar flush de working sets e standby list cleanup

### Epic 7: Disk Optimizer & Advanced Monitoring
**Goal:** Entregar otimizacao de disco (TRIM, desfrag, analise de espaco) e expandir monitoring (disco I/O, network, temperaturas completas, historico).
- Story 7.1: Implementar deteccao de tipo de disco (SSD/HDD) e TRIM manual para SSDs
- Story 7.2: Implementar desfragmentacao de HDDs com progresso visual
- Story 7.3: Implementar analise de espaco em disco com treemap visual
- Story 7.4: Implementar deteccao de arquivos grandes e duplicados
- Story 7.5: Implementar monitoramento de disco I/O, network, e temperaturas (disco, placa-mae)
- Story 7.6: Implementar historico de temperaturas com grafico temporal e export CSV

### Epic 8: Presets, Automation & Polish
**Goal:** Entregar presets globais, scheduler de limpeza automatica, perfis customizados, one-click optimize, e limpezas de cache restantes (thumbnails, DNS, Installer, Recent).
- Story 8.1: Implementar limpezas restantes: thumbnails, DNS, Windows Installer, Recent files
- Story 8.2: Implementar presets globais (Gamer, Developer, Streaming, Minimal) combinando servicos + startup + limpeza
- Story 8.3: Implementar criacao de perfis customizados com import/export
- Story 8.4: Implementar scheduler de limpeza automatica (diario, semanal, mensal, custom)
- Story 8.5: Implementar one-click optimize com progresso e resumo final

### Epic 9: Developer Mode
**Goal:** Entregar limpeza integrada de caches de desenvolvimento — diferencial unico do app, nenhum concorrente oferece. Alvo: 30-150GB recuperaveis em maquinas de desenvolvedor tipicas.
> Fonte: Pesquisa de foruns, secao 2.5.1 e Apendice A (mapa competitivo).
- Story 9.1: Implementar deteccao automatica de ferramentas de desenvolvimento instaladas (FR-053)
- Story 9.2: Implementar scan e limpeza de node_modules orfaos com heuristica de inatividade (FR-054)
- Story 9.3: Implementar limpeza de caches globais de package managers JS (npm, yarn, pnpm) (FR-055)
- Story 9.4: Implementar limpeza de Docker images/volumes/build cache nao utilizados (FR-056)
- Story 9.5: Implementar compactacao de discos virtuais WSL2 vhdx (FR-057)
- Story 9.6: Implementar limpeza de caches de pip, cargo, Go, Maven e Gradle (FR-058 a FR-061)
- Story 9.7: Implementar UI do Developer Mode com estimativa consolidada e selecao por categoria (FR-062)

### Epic 10: Gaming Mode
**Goal:** Entregar preset one-click para gaming que desliga servicos desnecessarios, limpa shader cache, flush de RAM, seta prioridade de processo, e restaura tudo ao sair. Diferencial: otimizacao REAL com honestidade, nao teatro.
> Fonte: Pesquisa de foruns, secoes 2.4.1, 2.4.2 e secao 6 (recomendacoes).
- Story 10.1: Implementar snapshot de estado do sistema e mecanismo de restore (FR-063, FR-068)
- Story 10.2: Implementar desativacao temporaria de servicos para gaming com lista configuravel (FR-064)
- Story 10.3: Integrar limpeza de GPU shader cache como etapa pre-gaming opcional (FR-065)
- Story 10.4: Integrar flush de RAM automatico ao ativar Gaming Mode (FR-066)
- Story 10.5: Implementar configuracao de prioridade de processo do jogo (FR-067)
- Story 10.6: Implementar selecao de .exe do jogo com ativacao/desativacao automatica (FR-069)
- Story 10.7: Implementar desativacao de Game DVR/Xbox Game Bar (FR-070)
- Story 10.8: Implementar UI do Gaming Mode com botao toggle, status visual, e lista de jogos configurados

---

## 10. Riscos Tecnicos

| ID | Risco | Probabilidade | Impacto | Mitigacao | Risco Residual |
|----|-------|---------------|---------|-----------|----------------|
| R-001 | Curva de aprendizado do Rust significativa | Media | Medio | Projeto tambem serve como aprendizado. Comecar com modulos simples (cache cleaner) antes dos complexos (servicos, monitoramento) | Medio |
| R-002 | WMI para temperaturas de CPU pode ser impreciso ou indisponivel em certos hardwares | Media | Medio | Fallback para sysinfo crate. Se nenhum funcionar, exibir "N/A" para temperatura. Testar em hardware disponivel primeiro | Baixo |
| R-003 | NVML pode nao estar disponivel se drivers NVIDIA nao estiverem instalados | Baixa | Baixo | Detect e graceful degradation: se NVML falhar, ocultar features NVIDIA e informar usuario | Baixo |
| R-004 | AMD GPU monitoring depende de ADL SDK com FFI bindings sem crate Rust madura | Alta | Medio | Mover para v1.0. No MVP, AMD apenas via WMI basico (info, sem temperaturas detalhadas). Criar FFI bindings customizados para v1.0 | Medio |
| R-005 | EmptyWorkingSet pode causar degradacao de performance se usado agressivamente | Media | Alto | Implementar com cooldown timer (min 5 min entre flushes). Nao aplicar em processos do sistema. Avisar usuario. Focar em monitoramento informativo, nao em cleanup automatico agressivo | Baixo |
| R-006 | Desativacao de servicos errados pode causar instabilidade do Windows | Media | Muito Alto | Categorias SAFE/CAUTION/DANGEROUS. Servicos DANGEROUS bloqueados no app. Backup obrigatorio antes de qualquer alteracao. Restore funcional testado antes do release | Baixo |
| R-007 | WebView2 nao instalado no Windows 10 | Media | Medio | Installer detecta e instala WebView2 automaticamente (bootstrapper da Microsoft) | Baixo |
| R-008 | Performance Counters (PDH) podem ter overhead se muitos counters forem lidos simultaneamente | Baixa | Medio | Limitar polling a counters essenciais. Usar sampling interval de 2s. Monitorar overhead do proprio app | Baixo |
| R-009 | Arquivos temporarios em uso podem causar erros de locking ao tentar deletar | Alta | Baixo | Catch silencioso de erros de acesso. Logar arquivos que nao puderam ser deletados. Exibir resumo "X de Y arquivos limpos" | Baixo |
| R-010 | Treemap visual pode ser pesado para discos com muitos arquivos | Media | Medio | Limitar profundidade de scan (configurable). Usar lazy loading na UI. Scan em thread separada com cancelamento | Baixo |
| R-011 | Winhance como concorrente open-source com features de debloating/telemetria ja implementadas e comunidade ativa | Media | Alto | Winhance foca em debloating/telemetria mas NAO oferece: GPU shader cache cleanup, Developer Mode, ou Gaming Mode. Esses 3 sao nossos diferenciais unicos (confirmado no mapa competitivo da pesquisa). Diferenciar-se pelo nicho tecnico (dev+gamer) ao inves de competir head-to-head em debloating. Monitorar releases e roadmap do Winhance. Se Winhance adicionar shader cache ou dev cleanup, acelerar entrega do nosso MVP. | Medio |
| R-012 | Docker CLI nao disponivel ou Docker Desktop nao rodando durante limpeza de caches Docker | Alta | Baixo | Graceful degradation: se Docker CLI nao estiver acessivel, desabilitar a feature de Docker cleanup com mensagem informativa ("Docker nao detectado ou nao esta rodando"). Nao bloquear o resto do Developer Mode. | Baixo |
| R-013 | WSL2 shutdown durante compactacao de vhdx pode causar perda de trabalho nao salvo em distribuicoes ativas | Media | Alto | Aviso proeminente antes de executar: "Esta operacao vai desligar TODAS as distribuicoes WSL2. Salve seu trabalho.". Listar distribuicoes ativas antes de executar. Cancelamento possivel antes do shutdown. Nao executar automaticamente — sempre manual com confirmacao. | Baixo |
| R-014 | Gaming Mode pode nao restaurar servicos apos crash do app | Media | Alto | Implementar mecanismo de recovery: ao iniciar, verificar se Gaming Mode estava ativo (flag persistido em disco). Se sim, oferecer restauracao imediata. Snapshot de estado salvo em arquivo JSON independente do processo do app. | Baixo |

---

## 11. Out of Scope

| Item | Justificativa |
|------|---------------|
| Modelo de negocio / Pricing / Freemium tiers | Projeto pessoal, sem distribuicao publica |
| Code Signing Certificate (EV ou OV) | Sem distribuicao publica, SmartScreen warnings aceitaveis |
| Microsoft Store submission | Sem distribuicao publica |
| Distribuicao via Winget, Chocolatey, GitHub Releases | Sem distribuicao publica |
| Telemetria / analytics do app | Zero data collection. Tudo local |
| Suporte multi-idioma (i18n) | Uso pessoal, ingles suficiente (ou PT-BR hardcoded) |
| Auto-update mechanism | Rebuild e reinstall manual e aceitavel para uso pessoal |
| Linux / macOS support | APIs sao Windows-only |
| Benchmark antes/depois | Feature cosmetic, pode ser adicionada futuramente |
| Cloud sync de perfis | Sem backend remoto |
| Driver updates | Fora do escopo de otimizacao de sistema |
| Registry cleaner | **PROIBIDO (CON-009).** Risco alto, beneficio negligivel (microsegundos). Microsoft desencoraja. CCleaner destruiu apps de usuarios com registry/duplicate cleaning. Flagged como PUP por antivirus. |
| "RAM boost" cosmetico / fake optimization | **PROIBIDO (CON-010).** Flush de standby list que dura ~6 minutos nao e otimizacao. Microsoft PC Manager faz e e criticado. Se oferecer flush, ser honesto sobre temporariedade. |
| Bundled software / toolbars / ofertas de terceiros | **PROIBIDO (CON-011).** Zero bundleware. IObit instala pacotes sem consentimento. CCleaner bundlava toolbar. Pratica toxica que destruiu a reputacao de concorrentes. |
| Malware / virus scanning | Fora do escopo, ja coberto por Windows Defender |

---

## 12. UI Design Goals

### Overall UX Vision
Interface dark com estetica "gamer tools" — minimalista mas poderosa. Inspiracao visual em ferramentas como GPU-Z, HWiNFO, e MSI Afterburner, mas com design moderno (nao anos 2000). Sidebar fixa com modulos, area principal com conteudo do modulo selecionado. Dashboard como home page.

### Key Interaction Paradigms
- **Scan-Preview-Confirm:** Para todas as operacoes de limpeza (scan mostra o que sera limpo, preview mostra espaco, confirm executa)
- **Monitor-Alert:** Para dashboard (dados real-time, alertas visuais quando thresholds ultrapassados)
- **Toggle-Diff-Apply:** Para servicos e startup (toggle mostra diff, apply executa com backup)

### Core Screens
1. **Dashboard** — Hub central com metricas real-time (CPU, RAM, GPU, temps, disco). Segue principio Honest UI (NFR-012).
2. **Cache Cleaner** — Scan, selecao por categoria, preview, execucao
3. **GPU Cache** — Deteccao de GPU, scan de shader caches, preview, execucao
4. **Developer Mode** — Deteccao de ferramentas dev, scan de caches por categoria, estimativa consolidada, selecao individual
5. **Gaming Mode** — Botao toggle principal, status visual (ativo/inativo), lista de jogos configurados, servicos a desativar, opcoes de shader cleanup e RAM flush
6. **Services** — Lista de servicos com classificacao, presets, backup/restore
7. **Startup** — Lista de items de inicializacao com toggle e impacto
8. **RAM** — Processos pesados, flush manual
9. **Disk** — Analise de espaco (treemap), TRIM/desfrag, arquivos grandes
10. **Settings** — Thresholds de temperatura, presets, scheduler, logs

### Accessibility
Nao aplicavel formalmente (uso pessoal). Foco em legibilidade (contraste adequado no dark theme, fontes >= 14px para dados).

### Target Platform
Desktop Windows apenas. Resolucao minima: 1280x720. Otimizado para 1920x1080.

---

## 13. Technical Assumptions

### Repository Structure
Monorepo unico contendo:
```
windows-optimizer/
  src-tauri/        # Rust backend
    src/
      modules/      # cache, gpu, services, startup, ram, disk, monitor, scheduler, dev_cleaner, gaming_mode
      commands/     # Tauri command handlers
      config/       # App config, presets
    Cargo.toml
  src/              # React frontend
    components/
    pages/
    hooks/
    stores/
    styles/
  package.json
  tauri.conf.json
```

### Service Architecture
Monolito local. Backend Rust e frontend React na mesma aplicacao Tauri. Sem microservicos, sem API externa.

### Testing Requirements
- **Rust backend:** Unit tests para cada modulo (cache paths, service classification, preset logic). Integration tests para WMI/NVML em CI com mocks.
- **React frontend:** Component tests com React Testing Library. Sem E2E no MVP (app desktop local).
- **Manual testing:** Obrigatorio para operacoes destrutivas (servicos, limpeza) em VM Windows antes de uso em maquina real.

---

## Checklist Results Report

### PM Checklist Execution (YOLO Mode)

| Category | Status | Critical Issues |
|----------|--------|-----------------|
| 1. Problem Definition & Context | PASS | Nenhum — estudo de viabilidade completo, persona definida |
| 2. MVP Scope Definition | PASS | MVP claro (3 modulos core), scope boundaries documentadas |
| 3. User Experience Requirements | PASS | Dark theme, scan-preview-confirm flow, screens definidas |
| 4. Functional Requirements | PASS | 52 FRs detalhados com ACs, paths especificos, APIs mapeadas |
| 5. Non-Functional Requirements | PASS | 10 NFRs com metricas concretas (<50MB, <10MB, <1s) |
| 6. Epic & Story Structure | PASS | 8 epics sequenciais, stories verticais, Epic 1 = foundation |
| 7. Technical Guidance | PASS | Stack completo, crates listados, arquitetura documentada |
| 8. Cross-Functional Requirements | PARTIAL | Sem integracao externa (OK, projeto local). Data storage via serde JSON (config) e buffer em memoria (monitoring). |
| 9. Clarity & Communication | PASS | Linguagem consistente, diagramas incluidos, terminologia uniforme |

**Overall:** 94% (8.5/9 sections PASS)
**MVP Scope:** Just Right
**Decision:** READY FOR ARCHITECT

### Nota sobre PARTIAL (Secao 8)
Cross-functional requirements sao minimos por design: projeto 100% local, sem integracao externa, sem banco de dados, sem API remota. O armazenamento e em arquivos JSON locais (configs, backups, logs). Isto nao e uma deficiencia, e uma constraint consciente.

---

## Next Steps

### Architect Prompt
```
@architect — Crie a arquitetura completa do projeto Windows Optimizer baseado no PRD em
docs/prd-windows-optimizer.md. Stack: Tauri 2.x + Rust (backend) + React/TypeScript (frontend).
Foco em: estrutura de modulos Rust, Tauri commands/IPC design, thread model para monitoring
real-time, UAC elevation strategy, e config/backup storage format. Use o estudo de viabilidade
em docs/research/windows-optimizer-app-study.md para referencia tecnica de APIs e crates.
```

### UX Expert Prompt
```
@ux-design-expert — Crie o design system e wireframes para o Windows Optimizer baseado no PRD
em docs/prd-windows-optimizer.md. Dark theme gamer aesthetic, dashboard com graficos real-time,
flow de scan-preview-confirm para limpezas, e layout de sidebar + content area.
Desktop Windows 1920x1080 otimizado.
```
