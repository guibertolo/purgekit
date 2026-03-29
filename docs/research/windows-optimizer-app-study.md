# Estudo de Viabilidade: Aplicativo Desktop de Otimizacao de Sistema Windows

**Projeto:** AIOX Windows Optimizer
**Data:** 2026-03-29
**Autor:** Atlas (AIOX Analyst)
**Nivel de Confianca Geral:** ALTO (85%) — dados de mercado validados em multiplas fontes
**Status:** Estudo Completo

---

## Sumario Executivo

Este estudo analisa a viabilidade tecnica, comercial e legal para criacao de um aplicativo desktop de otimizacao Windows pelo time AIOX. O mercado global de PC cleaner software e estimado em USD 1.83 bilhoes (2026), com projecao para USD 3.27 bilhoes ate 2035 (CAGR 6.7%). Existe espaco claro para um produto diferenciado, especialmente no nicho de **limpeza de cache GPU** e **privacidade/telemetria**, areas mal atendidas pelos concorrentes atuais.

**Recomendacao principal:** Desenvolver com **Tauri 2.x + Rust** (backend) + **React/TypeScript** (frontend), priorizando o MVP em 3 modulos core (limpeza cache, GPU cache, monitoramento).

---

## 1. Analise de Tecnologias Candidatas

### 1.1 Matriz Comparativa

| Criterio | Electron + Node.js | Tauri + Rust | C# + WPF/.NET | Python + PyQt |
|---|---|---|---|---|
| **RAM em idle** | 200-300 MB | 30-40 MB | 50-80 MB | 80-120 MB |
| **Tamanho instalador** | ~85 MB | ~2.5 MB | ~15 MB (com .NET) | ~50 MB (com runtime) |
| **Startup time** | 1-2s | <0.5s | <0.5s | 1-3s |
| **Acesso APIs Windows** | Via node-ffi/N-API | Nativo (windows crate) | Nativo (P/Invoke) | Via ctypes/pywin32 |
| **Acesso WMI** | Limitado (wmi-client) | Excelente (wmi crate) | Excelente (System.Management) | Bom (wmi module) |
| **Acesso Registry** | Via regedit npm | Nativo (winreg crate) | Nativo (Microsoft.Win32) | Via winreg module |
| **GPU APIs (NVML)** | Complexo (N-API bindings) | Excelente (nvml-wrapper) | Bom (P/Invoke) | Bom (pynvml) |
| **Distribuicao** | Simples (exe, MSI) | Simples (MSI, NSIS, WiX) | Simples (MSI, ClickOnce) | Complexa (PyInstaller) |
| **Seguranca** | Moderada (Chromium) | Excelente (capability-based) | Boa (sandboxing .NET) | Moderada |
| **Curva aprendizado** | Baixa (JS/TS) | Alta (Rust) | Media (C#) | Media (Python) |
| **Ecossistema** | Enorme (npm) | Crescente (crates.io) | Maduro (.NET) | Grande (PyPI) |
| **Performance sistema** | Baixa (pesado) | Excelente | Muito boa | Moderada |

### 1.2 Analise Detalhada por Stack

#### Tauri 2.x + Rust (RECOMENDADO)

**Pontos fortes:**
- Menor footprint de memoria (30-40 MB) — fundamental para um app de OTIMIZACAO
- Instalador minusculo (~2.5 MB) — valor percebido para usuario
- Acesso nativo a todas APIs Windows via `windows` crate da Microsoft
- WMI nativo via `wmi` crate com suporte a queries, eventos e execucao de metodos
- NVML wrapper maduro (`nvml-wrapper` crate v0.9+) para monitoramento GPU
- Sistema de permissoes granular (capability-based) — ideal para app que mexe no sistema
- Tauri 2.0 (lancado final 2024) com adocao crescente (+35% YoY)
- Possibilidade de plugins customizados em Rust puro

**Pontos fracos:**
- Curva de aprendizado do Rust e significativa
- Ecossistema menor que Node.js/C#
- Depende de WebView2 (pre-instalado no Windows 11, pode precisar instalar no Win10)

**Crates essenciais para o projeto:**
- `windows` — Bindings oficiais Microsoft para Win32 API
- `wmi` — Queries WMI para informacoes de hardware
- `nvml-wrapper` — Monitoramento GPU NVIDIA
- `winreg` — Acesso ao Registry do Windows
- `sysinfo` — Informacoes de CPU, RAM, disco
- `windows-service` — Gerenciamento de servicos Windows
- `tauri` — Framework do app

#### Electron + Node.js

**Pontos fortes:**
- Time AIOX ja domina TypeScript/JavaScript
- Maior ecossistema de bibliotecas
- Documentacao extensa

**Pontos fracos:**
- Contraditorio: app de otimizacao que consome 200-300 MB de RAM
- Instalador de 85+ MB para um "otimizador"
- Acesso limitado a APIs de baixo nivel do Windows
- Problemas de percepcao pelo usuario ("CCleaner de 3 MB vs isso de 100 MB")

**Veredicto:** Descartado. A ironia de um otimizador pesado prejudica a credibilidade do produto.

#### C# + WPF/.NET 9

**Pontos fortes:**
- Acesso nativo completo a todas APIs Windows
- Performance excelente para operacoes de sistema
- Ferramentas maduras (Visual Studio, WinForms, WPF)
- System.Management para WMI, Microsoft.Win32 para Registry

**Pontos fracos:**
- Requer .NET runtime (embora .NET 9 suporte self-contained publish)
- UI menos moderna que web technologies (sem Tailwind, etc.)
- Menos alinhado com stack AIOX (TypeScript/React)

**Veredicto:** Segunda opcao viavel. Excelente para sistema, mas UI menos flexivel.

#### Python + PyQt/PySide

**Pontos fortes:**
- Prototipagem rapida
- Boas bibliotecas de sistema (psutil, pywin32)

**Pontos fracos:**
- Distribuicao complexa (PyInstaller gera executaveis grandes e lentos)
- Performance inferior para operacoes de baixo nivel
- Elevacao UAC requer relancamento do processo inteiro (pyuac)
- Nao adequado para produto comercial desktop de alta qualidade

**Veredicto:** Descartado. Adequado para scripts, nao para produto comercial.

### 1.3 Decisao de Stack

| | Tauri + Rust | C# WPF | Electron | Python |
|---|---|---|---|---|
| Score final | **9.2/10** | 7.5/10 | 5.0/10 | 4.0/10 |
| Recomendacao | **ADOTAR** | Alternativa | Rejeitar | Rejeitar |

---

## 2. APIs Windows Necessarias

### 2.1 Mapa de APIs por Modulo

| API/Tecnologia | Modulo(s) | Rust Crate | Permissao |
|---|---|---|---|
| Win32 Service Control Manager | Servicos | `windows` crate | Admin |
| WMI (Win32_Service, Win32_Process) | Servicos, Monitor | `wmi` | User/Admin |
| Windows Registry (HKLM, HKCU) | Startup, Servicos | `winreg` | Admin (HKLM) |
| Task Scheduler API | Startup | `windows` crate | Admin |
| NVML (nvidia-smi) | GPU Monitor, GPU Cache | `nvml-wrapper` | User |
| ADL (AMD Display Library) | GPU Monitor, GPU Cache | FFI bindings | User |
| SetProcessWorkingSetSize | RAM Otimizacao | `windows` crate | Admin |
| EmptyWorkingSet | RAM Otimizacao | `windows` crate | Admin |
| Disk Management (DeviceIoControl) | Disco | `windows` crate | Admin |
| TRIM (IOCTL_STORAGE_MANAGE_DATA_SET_ATTRIBUTES) | Disco SSD | `windows` crate | Admin |
| Performance Counters (PDH) | Monitor | `windows` crate | User |
| PowerShell Interop | Diversos | `std::process::Command` | Varies |

### 2.2 Elevacao de Privilegios (UAC)

O aplicativo precisa de **privilegios de administrador** para a maioria das operacoes criticas. Estrategia recomendada:

1. **Modo normal** (sem elevacao): Monitoramento, limpeza de cache do usuario, informacoes do sistema
2. **Elevacao sob demanda**: Quando o usuario solicitar operacoes que requerem admin (servicos, startup HKLM, TRIM, RAM flush)
3. **Manifesto UAC**: Incluir `requireAdministrator` no manifesto do executavel, com opcao de rodar em modo limitado

### 2.3 Riscos de API

| API | Risco | Mitigacao |
|---|---|---|
| SetProcessWorkingSetSize | Pode causar unresponsiveness se usado agressivamente | Limitar a processos idle, com threshold minimo |
| Registry write (HKLM) | Pode quebrar o sistema se mal utilizado | Lista whitelist de chaves, backup antes de modificar |
| Service disable | Pode afetar funcionalidade do Windows | Categorizar servicos (safe/caution/dangerous) |
| TRIM command | Baixo risco, mas deve verificar se SSD | Auto-detectar tipo de disco |
| EmptyWorkingSet | Pode degradar performance se usado em excesso | Cooldown timer, nao aplicar em processos do sistema |

---

## 3. Funcionalidades Detalhadas por Modulo

### 3.1 Modulo: Limpeza de Cache

| Alvo | Paths/APIs | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| Temp files (%TEMP%) | `%LOCALAPPDATA%\Temp\`, `%WINDIR%\Temp\` | User/Admin | 1/5 | MVP |
| Browser cache (Chrome) | `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache\` | User | 2/5 | MVP |
| Browser cache (Firefox) | `%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*\cache2\` | User | 2/5 | MVP |
| Browser cache (Edge) | `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache\` | User | 2/5 | MVP |
| Windows Update cache | `%WINDIR%\SoftwareDistribution\Download\` | Admin | 2/5 | MVP |
| Prefetch | `%WINDIR%\Prefetch\` | Admin | 1/5 | MVP |
| Thumbnails cache | `%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache_*` | User | 1/5 | v1.0 |
| DNS cache | `ipconfig /flushdns` | Admin | 1/5 | v1.0 |
| Windows Installer cache | `%WINDIR%\Installer\$PatchCache$\` | Admin | 3/5 | v1.0 |
| Recycle Bin | Shell API | User | 1/5 | MVP |
| Recent files list | Registry + Shell | User | 1/5 | v1.0 |

**Riscos:** Baixo. Apenas arquivos temporarios/cache sao removidos. Excecao: Windows Installer cache pode afetar uninstalls.

### 3.2 Modulo: Limpeza de Cache GPU

| Alvo | Paths/APIs | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| NVIDIA DXCache | `%LOCALAPPDATA%\NVIDIA\DXCache\` | User | 1/5 | MVP |
| NVIDIA GLCache | `%LOCALAPPDATA%\NVIDIA\GLCache\` | User | 1/5 | MVP |
| NVIDIA NV_Cache | `%LOCALAPPDATA%\NVIDIA Corporation\NV_Cache\` | User | 1/5 | MVP |
| AMD Shader Cache | `%LOCALAPPDATA%\AMD\DxCache\` | User | 1/5 | MVP |
| AMD GL Cache | `%LOCALAPPDATA%\AMD\GLCache\` | User | 1/5 | MVP |
| DirectX Shader Cache | `%LOCALAPPDATA%\D3DSCache\` | User | 1/5 | MVP |
| Intel Shader Cache | `%LOCALAPPDATA%\Intel\ShaderCache\` | User | 1/5 | v1.0 |
| Steam Shader Cache | `Steam\steamapps\shadercache\` | User | 2/5 | v1.0 |
| Pipeline Cache (Vulkan) | `%LOCALAPPDATA%\*\pipeline_cache\` | User | 2/5 | v1.0 |

**Riscos:** Baixo. Shader caches sao regenerados automaticamente. O usuario pode experimentar loading times mais longos na primeira execucao de jogos apos limpeza.

**DIFERENCIAL COMPETITIVO:** Nenhum dos concorrentes principais oferece limpeza de GPU cache de forma abrangente. Este e o **killer feature** do produto.

### 3.3 Modulo: Otimizacao de Servicos

| Funcionalidade | API | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| Listar servicos | WMI Win32_Service | User | 2/5 | MVP |
| Desativar servico | Service Control Manager | Admin | 3/5 | MVP |
| Presets (Gaming, Work, Minimal) | Combinacao de configs | Admin | 4/5 | v1.0 |
| Telemetria Microsoft | Registry + Services | Admin | 3/5 | MVP |
| Restaurar servico original | Backup + SCM | Admin | 3/5 | MVP |

**Servicos candidatos a desativacao (categorizados):**

| Categoria | Servicos | Seguranca |
|---|---|---|
| **SAFE** (telemetria) | DiagTrack, dmwappushservice, Connected User Exp. | Verde |
| **SAFE** (funcionalidade desnecessaria) | Fax, MapsBroker, RetailDemo | Verde |
| **CAUTION** | Print Spooler (se nao usa impressora), Bluetooth (se nao usa), Xbox Services | Amarelo |
| **DANGEROUS** (nao desativar) | Windows Update, Windows Defender, RPC, DCOM | Vermelho |

**Riscos:** MEDIO-ALTO. Desativar servicos errados pode causar instabilidade. Mitigacao: sistema de backup de estado, categorizacao clara, confirmacao do usuario.

### 3.4 Modulo: Gerenciamento de Inicializacao

| Funcionalidade | API | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| Listar programas startup | Registry (Run/RunOnce) + Task Scheduler + Shell:Startup | User/Admin | 3/5 | MVP |
| Desativar item startup | Registry + Task Scheduler | Admin | 3/5 | MVP |
| Medir impacto de cada item | Performance Counters + timing | Admin | 4/5 | v1.0 |
| Delayed start | Task Scheduler | Admin | 3/5 | v1.0 |

**Locais de startup monitorados:**
- `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
- `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
- `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce`
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
- Task Scheduler (logon triggers)

**Riscos:** MEDIO. Desativar items errados pode afetar funcionalidade de apps. Mitigacao: informar ao usuario qual app e responsavel, marcar items do sistema como protegidos.

### 3.5 Modulo: Otimizacao de RAM

| Funcionalidade | API | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| Monitorar uso RAM | WMI + Performance Counters | User | 2/5 | MVP |
| Flush working set (processos idle) | SetProcessWorkingSetSize / EmptyWorkingSet | Admin | 3/5 | v1.0 |
| Identificar processos "heavy" | WMI Win32_Process | User | 2/5 | MVP |
| Auto-clean em threshold | Background task | Admin | 4/5 | v1.0 |

**AVISO IMPORTANTE:** A otimizacao de RAM via EmptyWorkingSet e controversa. O Windows ja gerencia memoria de forma eficiente. O uso agressivo pode:
- Causar page faults excessivos
- Degradar performance em vez de melhorar
- Em casos extremos, tornar o sistema unresponsivo

**Abordagem recomendada:** Focar em MONITORAMENTO e INFORMACAO (quais processos usam mais RAM) em vez de "limpeza" automatica agressiva. Oferecer flush manual com aviso claro.

### 3.6 Modulo: Otimizacao de Disco

| Funcionalidade | API | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| Analisar uso de disco | FileSystem API | User | 2/5 | MVP |
| TRIM SSD | DeviceIoControl (IOCTL_STORAGE_MANAGE_DATA_SET_ATTRIBUTES) | Admin | 4/5 | v1.0 |
| Desfragmentar HDD | defrag.exe CLI ou Optimize-Volume | Admin | 3/5 | v1.0 |
| Detectar tipo disco (SSD/HDD) | WMI Win32_DiskDrive | User | 2/5 | MVP |
| Encontrar arquivos grandes | FileSystem scan | User | 2/5 | v1.0 |
| Encontrar duplicados | Hash comparison | User | 4/5 | Future |

**Riscos:** BAIXO para analise, MEDIO para TRIM/defrag (operacoes I/O intensivas). Mitigacao: verificar tipo de disco antes de operar, nao desfragmentar SSDs.

### 3.7 Modulo: Monitoramento de Sistema (Dashboard)

| Funcionalidade | API | Permissao | Complexidade | Prioridade |
|---|---|---|---|---|
| CPU uso real-time | Performance Counters / WMI | User | 2/5 | MVP |
| RAM uso real-time | GlobalMemoryStatusEx | User | 1/5 | MVP |
| GPU uso/temp (NVIDIA) | NVML (nvml-wrapper) | User | 3/5 | MVP |
| GPU uso/temp (AMD) | ADL SDK (FFI bindings) | User | 4/5 | v1.0 |
| Disco I/O | Performance Counters | User | 3/5 | v1.0 |
| Network throughput | Performance Counters | User | 3/5 | v1.0 |
| Temperatura CPU | WMI MSAcpi_ThermalZoneTemperature | Admin | 3/5 | v1.0 |
| Info hardware completa | WMI + SMBIOS | User | 3/5 | MVP |

**Riscos:** BAIXO. Operacoes de leitura apenas.

---

## 4. Analise Competitiva

### 4.1 Matriz de Concorrentes

| Feature | CCleaner | BleachBit | Adv. SystemCare | Wise Care 365 | O&O ShutUp10 | **AIOX Optimizer** |
|---|---|---|---|---|---|---|
| Limpeza cache basica | Sim | Sim | Sim | Sim | Nao | **Sim** |
| Limpeza GPU cache | **Nao** | **Nao** | **Nao** | **Nao** | **Nao** | **SIM** |
| Otimizacao servicos | Basica | Nao | Sim | Basica | Nao | **Sim (presets)** |
| Controle telemetria | Nao | Nao | Basico | Nao | **Sim (foco)** | **Sim** |
| Gerenciamento startup | Sim | Nao | Sim | Sim | Nao | **Sim** |
| RAM optimizer | Nao | Nao | Sim | Sim | Nao | **Sim (informativo)** |
| Disco otimizacao | Nao | Nao | Sim | Sim | Nao | **Sim** |
| Monitor real-time | Nao | Nao | Sim | Nao | Nao | **Sim (GPU incl.)** |
| GPU monitoring | **Nao** | **Nao** | **Nao** | **Nao** | **Nao** | **SIM** |
| Open source | Nao | Sim | Nao | Nao | Nao | Parcial* |
| Tamanho instalador | ~25 MB | ~15 MB | ~50 MB | ~20 MB | ~1 MB | **~3-5 MB** |
| RAM consumida | ~50 MB | ~30 MB | ~150 MB | ~80 MB | Minimal | **~30-40 MB** |
| Modelo negocio | Freemium | Free/OSS | Freemium | Freemium | Free | **Freemium** |
| Preco Pro/ano | $29.95 | N/A | $19.99 | $29.95 | N/A | **$14.99** |

*Parcial: core do engine open source, UI/premium features proprietario.

### 4.2 Detalhamento dos Concorrentes

#### CCleaner (Piriform/Gen Digital)
- **Receita estimada:** >$100M/ano
- **Pontos fortes:** Brand recognition, base instalada massiva, confiavel
- **Pontos fracos:** Historico de seguranca (breach 2017), nao inovou significativamente, sem GPU features
- **Preco:** $29.95/ano (Pro), $39.95/ano (Pro+), $49.95/ano (Premium)
- **Mudanca 2024:** Migrou para modelo subscription, gerando insatisfacao

#### BleachBit
- **Modelo:** Open source, gratuito
- **Pontos fortes:** Confiavel, sem bloatware, transparente
- **Pontos fracos:** UI datada, sem features avancadas (servicos, monitor, GPU)
- **Oportunidade:** Muitos usuarios BleachBit querem mais features sem sacrificar leveza

#### Advanced SystemCare (IObit)
- **Receita estimada:** >$100M/ano (portfolio IObit)
- **Pontos fortes:** Feature-rich, AI-powered (2024+)
- **Pontos fracos:** Bloated (150+ MB RAM), bundleware agressivo, reputacao mista
- **Preco:** $19.99/ano (Pro)

#### Wise Care 365
- **Modelo:** Freemium
- **Pontos fortes:** Interface limpa, leve, funcional
- **Pontos fracos:** Pouca inovacao, sem GPU features, sem monitoramento real-time

#### O&O ShutUp10++
- **Modelo:** Gratuito, portavel
- **Pontos fortes:** Foco em privacidade/telemetria, confiavel, portavel (sem instalacao)
- **Pontos fracos:** APENAS privacidade, sem limpeza ou otimizacao, UI minimalista

### 4.3 Gaps Identificados no Mercado

1. **Limpeza de cache GPU** — NENHUM concorrente oferece isso de forma dedicada
2. **Monitoramento GPU integrado** — Requer apps separados (GPU-Z, HWiNFO)
3. **Presets de otimizacao por contexto** (Gaming, Work, Minimal) — Nenhum oferece
4. **Combinacao privacidade + otimizacao + GPU** — Ninguem faz tudo
5. **App ultra-leve (<5 MB)** que faz tudo que CCleaner faz — Apenas BleachBit se aproxima
6. **Transparencia de acoes** — A maioria nao explica claramente o que cada acao faz

### 4.4 Posicionamento Sugerido

> "O otimizador mais leve do mercado, com o unico sistema dedicado de limpeza de cache GPU e monitoramento de hardware em tempo real."

Publico-alvo principal: **Gamers e power users** que querem:
- Maximizar FPS (GPU cache cleanup)
- Controlar telemetria (privacidade)
- Monitorar hardware sem abrir 5 apps diferentes
- Um app que nao seja ele mesmo um problema de performance

---

## 5. Modelo de Negocio

### 5.1 Estrutura Freemium

#### Free Tier
- Limpeza de cache basica (temp, browser, prefetch)
- Limpeza de GPU cache (DIFERENCIAL — mantido free para adocao)
- Monitoramento de sistema basico (CPU, RAM)
- Analise de disco
- Ate 3 limpezas por dia

#### Pro Tier — R$ 49,90/ano (~$9.99/ano)
- Limpezas ilimitadas
- Otimizacao de servicos com presets
- Gerenciamento de startup completo
- Monitoramento GPU avancado (NVIDIA + AMD, historico)
- Otimizacao de RAM
- TRIM/Desfrag automatico
- Controle de telemetria avancado
- Scheduler (limpeza automatica programada)
- Suporte prioritario

#### Pricing Rationale
- CCleaner Pro: $29.95/ano → nosso preco e ~66% menor
- Advanced SystemCare Pro: $19.99/ano → nosso e ~50% menor
- Preco agressivo para captura de mercado inicial
- Conversao estimada Free→Pro: 3-5% (padrao freemium utilities)

### 5.2 Canais de Distribuicao

| Canal | Prioridade | Custo | Notas |
|---|---|---|---|
| **Site proprio** | Alta | Hosting + dominio | Controle total, sem comissao |
| **Microsoft Store** | Alta | 15% comissao | Confianca do usuario, distribuicao facilitada |
| **GitHub Releases** | Media | Gratuito | Comunidade dev/power user |
| **Steam** | Baixa (futura) | 30% comissao | Publico gamer, mas comissao alta |
| **Winget** | Media | Gratuito | Power users, instalacao via CLI |
| **Chocolatey** | Media | Gratuito | Comunidade dev |

### 5.3 Monetizacao Adicional (Future)

- Relatorio de saude do sistema (PDF exportavel) — Pro feature
- Perfis de otimizacao sincronizados na nuvem — Pro feature
- Licenca enterprise (multiplas maquinas) — pricing separado
- Benchmark integrado (antes/depois da otimizacao) — engagement feature

---

## 6. Riscos e Consideracoes Legais

### 6.1 Antivirus False Positives (RISCO ALTO)

**Problema:** Apps que acessam Registry, Services e processos do sistema sao frequentemente flagados como malware por heuristica.

**Dados recentes (2025-2026):**
- Windows Defender usa ML-based detection que gera falsos positivos mesmo para apps assinados
- Desenvolvedores relatam que Defender bloqueia ate projetos recem-compilados (Trojan:Win32/Phonzy.A!ml)
- Apps feitos com Tauri/Wails/Go tambem sao afetados

**Mitigacao:**
1. **Code Signing Certificate EV** (obrigatorio) — $279-$581/ano
2. Submeter ao Microsoft Defender Security Intelligence Portal antes do lancamento
3. Submeter ao VirusTotal e corrigir qualquer deteccao antes de release
4. Construir reputacao gradual no SmartScreen (requer volume de downloads)
5. Disponibilizar no Microsoft Store (aumenta confianca)
6. Manter o codigo open source (parcialmente) para auditoria

**NOTA IMPORTANTE (marco 2024):** Microsoft mudou como SmartScreen interage com EV certificates. Certificados EV nao removem mais instantaneamente avisos SmartScreen. E necessario construir reputacao ao longo do tempo.

### 6.2 Code Signing Certificate

| Tipo | Preco/ano | Beneficio |
|---|---|---|
| OV (Organization Validation) | $215-$350 | Assinatura basica, SmartScreen lento |
| **EV (Extended Validation)** | **$279-$581** | Maior confianca, SmartScreen mais rapido |

**Mudanca 2026:** A partir de fev/2026, certificados limitados a max 459 dias (1 ano + buffer). Renovacao anual obrigatoria.

**Recomendacao:** Comecar com EV da Sectigo ($279/ano) — melhor custo-beneficio.

### 6.3 Politica da Microsoft

**Microsoft PC Manager:** A Microsoft lancou seu proprio otimizador (PC Manager), disponivel no Microsoft Store. Isso indica:
- Microsoft nao proibe otimizadores de terceiros
- Mas pode competir diretamente
- O Microsoft Store aceita apps de otimizacao (ja existem varias)
- Diferenciar-se do PC Manager e crucial (GPU cache, presets, monitoramento avancado)

### 6.4 LGPD/Privacidade

| Aspecto | Requisito | Implementacao |
|---|---|---|
| Coleta de dados | Nenhum dado pessoal coletado | Processar tudo localmente |
| Telemetria do app | Opt-in apenas | Analytics anonimo opcional |
| Dados de uso | Nunca enviar | Nao transmitir dados do sistema do usuario |
| Politica de Privacidade | Obrigatorio | Publicar no site e no app |

**Principio:** Zero telemetria por padrao. Tudo roda localmente. Isso e tambem um diferencial de marketing.

### 6.5 Matriz de Riscos Consolidada

| Risco | Probabilidade | Impacto | Mitigacao | Risco Residual |
|---|---|---|---|---|
| False positive AV | Alta | Alto | EV cert + submissions + Store | Medio |
| Dano ao sistema do usuario | Media | Muito Alto | Backups, categorias safety, confirmacoes | Baixo |
| Microsoft PC Manager competir | Alta | Medio | Diferenciar com GPU + presets | Baixo |
| Rust learning curve | Media | Medio | Treinamento, pair programming | Medio |
| Regulamentacao futura | Baixa | Medio | Zero data collection, compliance | Baixo |

---

## 7. Estimativa de Escopo

### 7.1 MVP (Minimum Viable Product)

**Objetivo:** Lancamento inicial com os 3 maiores diferenciais

| Modulo | Features MVP | Complexidade | Estimativa (story points) |
|---|---|---|---|
| Limpeza Cache | Temp, browser, prefetch, Update, Recycle Bin | 2/5 | 13 |
| Limpeza GPU Cache | NVIDIA (DX/GL/NV_Cache), AMD, DirectX | 2/5 | 8 |
| Monitor Sistema | CPU, RAM, GPU (NVIDIA), info hardware | 3/5 | 13 |
| UI Shell | Dashboard, navegacao, dark/light theme | 3/5 | 21 |
| Infra | Installer (NSIS), auto-update, UAC handling | 4/5 | 21 |
| **Total MVP** | | | **76 SP** |

**Estimativa tempo MVP:** 6-8 semanas (com 1 dev full-time Rust + 1 dev frontend)

### 7.2 v1.0 (Feature Complete)

| Modulo | Features Adicionais | Complexidade | Estimativa (SP) |
|---|---|---|---|
| Servicos | Listar, desativar, presets, restore | 4/5 | 21 |
| Startup | Listar, desativar, impact analysis | 3/5 | 13 |
| RAM | Monitoramento, flush manual, heavy process list | 3/5 | 13 |
| Disco | Analise, TRIM, desfrag, arquivos grandes | 4/5 | 21 |
| Monitor (avancado) | AMD GPU, temp CPU, disco I/O, network, historico | 4/5 | 21 |
| Telemetria | Toggle telemetria Windows, presets privacidade | 3/5 | 13 |
| Pro features | Scheduler, licenciamento, limpeza ilimitada | 4/5 | 21 |
| Polish | Onboarding, i18n (PT/EN), benchmark antes/depois | 3/5 | 13 |
| **Total v1.0** | | | **136 SP adicionais** |
| **Total acumulado** | | | **212 SP** |

**Estimativa tempo v1.0:** 12-16 semanas apos MVP (incrementally)

### 7.3 Roadmap Visual

```
Mes 1-2:     [===== MVP ========================]
             Setup Tauri + Cache + GPU Cache + Monitor basico

Mes 3-4:     [===== v0.5 =======================]
             Servicos + Startup + Telemetria

Mes 5-6:     [===== v0.8 =======================]
             RAM + Disco + Monitor avancado

Mes 7-8:     [===== v1.0 =======================]
             Pro features + Polish + Lancamento
```

---

## 8. Recomendacao de Stack Final

### Stack Recomendado

```
+------------------------------------------+
|           AIOX Windows Optimizer          |
+------------------------------------------+
|  Frontend: React + TypeScript + Tailwind  |
|  (Tauri WebView2)                         |
+------------------------------------------+
|  Backend: Rust                            |
|  - windows crate (Win32 API)              |
|  - wmi crate (hardware info)              |
|  - nvml-wrapper (GPU NVIDIA)              |
|  - winreg (Registry)                      |
|  - sysinfo (CPU/RAM/Disco)               |
|  - tauri (framework)                      |
+------------------------------------------+
|  Distribuicao:                            |
|  - NSIS installer (~3-5 MB)              |
|  - Microsoft Store (WebView2 included)    |
|  - Winget / Chocolatey                    |
+------------------------------------------+
|  Code Signing: Sectigo EV ($279/ano)      |
+------------------------------------------+
```

### Justificativas da Escolha

1. **Performance:** Tauri+Rust e o stack mais leve possivel — essencial para um OTIMIZADOR
2. **Acesso Windows:** Todas as APIs necessarias tem crates Rust maduros (windows, wmi, nvml-wrapper)
3. **Seguranca:** Capability-based permissions do Tauri se alinham com a necessidade de operacoes privilegiadas controladas
4. **Tamanho:** Instalador de ~3-5 MB vs 85 MB (Electron) — valor percebido enorme
5. **Alinhamento AIOX:** Frontend React+TS se alinha com o stack padrao AIOX (nextjs-react preset)
6. **CLI-First:** O backend Rust pode expor CLI antes da UI, alinhando com a Constitution AIOX
7. **Mercado:** Tauri esta em ascensao (+35% YoY), com comunidade ativa e suporte da Microsoft (windows crate oficial)

### Pre-requisitos para o Time

| Habilidade | Nivel Necessario | Estrategia de Capacitacao |
|---|---|---|
| Rust basico | Intermediario | Rust Book + exercicios (2-4 semanas) |
| Tauri 2.x | Basico | Documentacao oficial + starter template (1 semana) |
| Win32 API concepts | Basico | Aprender conforme necessidade via windows crate docs |
| React + TypeScript | Ja existe no time | Stack AIOX atual |
| Tailwind CSS | Ja existe no time | Stack AIOX atual |

---

## 9. Proximos Passos Recomendados

1. **@pm** — Criar PRD formal baseado neste estudo, priorizando MVP
2. **@architect** — Design da arquitetura Tauri+Rust, definir modulos e interfaces
3. **@dev** — Spike tecnico: criar Tauri app basico que le WMI e NVML (proof of concept)
4. **@po** — Criar epics e stories baseadas nos modulos definidos
5. **Investimento imediato:** Adquirir EV code signing certificate (Sectigo, $279/ano)
6. **Treinamento:** Iniciar capacitacao Rust para o time (2-4 semanas antes do dev)

---

## Fontes

### Tecnologia
- [Tauri vs Electron: Complete Developer's Guide 2026](https://blog.nishikanta.in/tauri-vs-electron-the-complete-developers-guide-2026)
- [Tauri vs Electron: Performance, Bundle Size and Trade-offs](https://www.gethopp.app/blog/tauri-vs-electron)
- [Rust for Windows — Microsoft Learn](https://learn.microsoft.com/en-us/windows/dev-environment/rust/rust-for-windows)
- [WMI Crate for Rust](https://docs.rs/wmi/latest/wmi/)
- [NVML Wrapper for Rust](https://github.com/rust-nvml/nvml-wrapper)
- [NVIDIA Management Library (NVML)](https://developer.nvidia.com/management-library-nvml)
- [Windows APIs Rust Crates](https://lib.rs/os/windows-apis)
- [Tauri Windows Installer](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri Windows Service Example](https://github.com/mmsinclair/tauri-windows-service)

### Mercado
- [PC Cleaner Software Market 2025-2033](https://www.marketreportanalytics.com/reports/pc-cleaner-software-55548)
- [Disk Cleanup Software Market 2026-2035](https://www.businessresearchinsights.com/market-reports/disk-cleanup-software-market-105503)
- [CCleaner Plans and Pricing](https://www.ccleaner.com/ccleaner/plans)
- [CCleaner Review 2026](https://cybernews.com/privacy-tools/ccleaner-review/)
- [Top 10 PC Cleaner Tools 2026](https://www.softwaretestinghelp.com/best-free-pc-cleaner-software/)
- [Microsoft PC Manager](https://pcmanager.microsoft.com/en-us)

### GPU Cache
- [NVIDIA Shader Cache Deletion](https://nvidia.custhelp.com/app/answers/detail/a_id/5735)
- [Clear NVIDIA AMD Graphics Cache](https://www.thewindowsclub.com/clear-nvidia-amd-or-autocad-graphics-cache)

### Seguranca e Legal
- [Microsoft Defender False Positives](https://textslashplain.com/2026/01/27/microsoft-defender-false-positives/)
- [Code Signing Certificate Costs](https://codesigncert.com/blog/code-signing-certificate-cost)
- [Top 5 Cheap Code Signing Providers 2026](https://codesigncert.com/top-5-cheapest-code-signing-provider)
- [Sectigo EV Code Signing](https://cheapsslsecurity.com/sectigo/sectigo-ev-code-signing-certificate.html)
- [Windows SmartScreen and EV Certificates](https://www.vgc.io/news/about-windows-scary-warnings-and-code-signing-certificates)
- [O&O ShutUp10++](https://www.oo-software.com/en/shutup10)

### Competidores
- [Advanced SystemCare vs BleachBit](https://appmus.com/vs/advanced-systemcare-free-vs-bleachbit)
- [CCleaner vs Advanced SystemCare 2026](https://www.couponswebdeal.com/iobit-advanced-systemcare-vs-ccleaner/)
- [ShutUp10++ Alternatives](https://alternativeto.net/software/shutup10/)

---

*Estudo conduzido por Atlas (AIOX Analyst) em 2026-03-29*
*Nivel de confianca: ALTO (85%) — baseado em dados de mercado reais e documentacao tecnica verificada*
*Incertezas: Curva de aprendizado Rust (depende do time), taxa de conversao freemium (estimativa padrao de mercado)*
