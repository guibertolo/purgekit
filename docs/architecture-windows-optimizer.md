# Windows Optimizer - Architecture Document

**Projeto:** Windows Optimizer
**Versao:** 1.0.0
**Data:** 2026-03-29
**Autor:** Aria (Architect Agent)
**PRD:** `docs/prd-windows-optimizer.md` v1.1.0
**Estudos:** `docs/research/windows-optimizer-app-study.md`, `docs/research/user-needs-forum-research.md`
**Status:** Draft

---

## Table of Contents

1. [Visao Geral](#1-visao-geral)
2. [Estrutura do Projeto](#2-estrutura-do-projeto)
3. [Crates Rust](#3-crates-rust)
4. [Modulos do Backend](#4-modulos-do-backend-rust)
5. [Frontend](#5-frontend-reacttypescript)
6. [IPC — Inter-Process Communication](#6-ipc--inter-process-communication)
7. [Seguranca](#7-seguranca)
8. [Testes](#8-testes)
9. [Build e Distribuicao](#9-build-e-distribuicao)
10. [Monitoramento de Temperaturas](#10-monitoramento-de-temperaturas--detalhe-tecnico)
11. [ADRs](#11-architecture-decision-records)

---

## 1. Visao Geral

### 1.1 Diagrama de Componentes

```
+============================================================================+
|                       WINDOWS OPTIMIZER (Tauri 2.x)                         |
+============================================================================+
|                                                                              |
|  +--------------------------------------------------------------------+     |
|  |                    FRONTEND (WebView2 Runtime)                      |     |
|  |                    React 18 + TypeScript + Tailwind                 |     |
|  |                                                                    |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |  |  Dashboard Page  |  |  Cleaner Pages   |  |  Monitor Pages  |   |     |
|  |  |  (home, metrics) |  |  (cache, gpu,    |  |  (cpu, ram,     |   |     |
|  |  |                  |  |   dev, gaming)   |  |   gpu, temps)   |   |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |  |  Manager Pages   |  |  Settings Page   |  |  Shared UI      |   |     |
|  |  |  (services,      |  |  (thresholds,    |  |  (sidebar,      |   |     |
|  |  |   startup, ram,  |  |   presets, logs)  |  |   confirm       |   |     |
|  |  |   disk)          |  |                  |  |   dialogs)      |   |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |                                                                    |     |
|  |  State: Zustand stores  |  Charts: Recharts  |  Router: TanStack  |     |
|  +--------------------------------------------------------------------+     |
|         |              |               |                                     |
|         | invoke()     | listen()      | emit()                             |
|         v              v               v                                     |
|  +====================================================================+     |
|  |                    TAURI IPC BRIDGE                                  |     |
|  |     Commands (request/response)  |  Events (streaming/push)         |     |
|  |     serde JSON serialization     |  Typed payloads                  |     |
|  +====================================================================+     |
|         |              |               |                                     |
|         v              v               v                                     |
|  +--------------------------------------------------------------------+     |
|  |                    BACKEND (Rust)                                    |     |
|  |                                                                    |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |  | commands/        |  | modules/         |  | platform/       |   |     |
|  |  | (Tauri command   |  | (Business logic  |  | (Windows API    |   |     |
|  |  |  handlers, thin  |  |  per domain)     |  |  abstractions)  |   |     |
|  |  |  delegation)     |  |                  |  |                 |   |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |  | services/        |  | config/          |  | state/          |   |     |
|  |  | (Background      |  | (Presets, prefs, |  | (AppState,      |   |     |
|  |  |  monitor loops,  |  |  backup/restore) |  |  monitor bufs,  |   |     |
|  |  |  scheduler)      |  |                  |  |  gaming snap)   |   |     |
|  |  +------------------+  +------------------+  +-----------------+   |     |
|  |                                                                    |     |
|  +--------------------------------------------------------------------+     |
|         |              |               |               |                     |
|         v              v               v               v                     |
|  +====================================================================+     |
|  |                    PLATFORM / OS LAYER                              |     |
|  |                                                                    |     |
|  |  windows crate    wmi crate      nvml-wrapper    sysinfo crate     |     |
|  |  (Win32 API)      (WMI queries)  (NVIDIA GPU)    (CPU/RAM/Disk)    |     |
|  |                                                                    |     |
|  |  winreg crate     tokio          serde/chrono    std::process      |     |
|  |  (Registry)       (async runtime) (serialization) (CLI commands)   |     |
|  +====================================================================+     |
|         |              |               |               |                     |
|         v              v               v               v                     |
|  +====================================================================+     |
|  |                    WINDOWS OS                                       |     |
|  |  Service Control Manager | WMI | Registry | NVML | PDH | Shell    |     |
|  +====================================================================+     |
+==============================================================================+
```

### 1.2 Fluxo de Dados Principal

```
FRONTEND                        IPC                         BACKEND
---------                      -----                       ---------

[User clicks "Scan"]
        |
        +----> invoke("scan_system_cache") -----> commands::cache::scan_system_cache()
                                                          |
                                                          v
                                                  modules::cache_cleaner::scan()
                                                          |
                                                          v
                                                  platform::filesystem::scan_dirs()
                                                          |
                                                          +----> Returns ScanResult {
                                                          |        categories: Vec<CacheCategory>,
                                                          |        total_size_bytes: u64,
                                                          |      }
                                                          |
        <---- Result<ScanResult, AppError> <------+

[User confirms cleanup]
        |
        +----> invoke("clean_system_cache", { categories }) ---> commands::cache::clean()
                                                                        |
                                                                        v
                                                                modules::cache_cleaner::clean()
                                                                        |
                                                          (emits progress events)
                                                                        |
        <---- listen("cleanup-progress") <--- emit("cleanup-progress", { step, pct }) ---|
        <---- listen("cleanup-progress") <--- emit("cleanup-progress", { step, pct }) ---|
        ...
        <---- Result<CleanResult> <--- returns final result
```

**Monitoring streaming flow (temperatures, CPU, RAM):**

```
BACKEND (spawn at app start)                     FRONTEND
-------------------------------                  --------

tokio::spawn(monitor_loop)
    |
    +---> loop every 2s:
    |       sysinfo::refresh_all()
    |       nvml::device.temperature()
    |       wmi::query::<ThermalZone>()
    |       |
    |       +---> app_handle.emit("system-metrics", SystemMetrics { ... })
    |
    |                                            listen("system-metrics")
    |                                                |
    |                                                v
    |                                            updateMetricsStore(data)
    |                                                |
    |                                                v
    |                                            <Recharts re-renders>
```

### 1.3 Modelo de Permissoes

O app opera em dois modos de privilegio. A decisao de quando elevar e feita no backend, nunca no frontend.

| Operacao | Requer Admin? | Estrategia |
|----------|:------------:|------------|
| Monitoramento (CPU, RAM, GPU NVIDIA, disco) | Nao | Executa em user-mode |
| Temp files do usuario (`%TEMP%`) | Nao | Deleta direto |
| Browser cache | Nao | Deleta direto |
| GPU shader cache | Nao | Deleta direto |
| Dev caches (npm, pip, cargo) | Nao | Deleta direto |
| Recycle Bin | Nao | Shell API |
| Docker prune | Nao | Docker CLI |
| Temp do Windows (`C:\Windows\Temp`) | **Sim** | Elevacao sob demanda |
| Prefetch, Windows Update cache | **Sim** | Elevacao sob demanda |
| Temperatura CPU (WMI ThermalZone) | **Sim** | Fallback: sysinfo sem admin |
| Servicos (start/stop/disable) | **Sim** | Elevacao sob demanda |
| Startup items HKLM | **Sim** | Elevacao sob demanda |
| TRIM SSD | **Sim** | Elevacao sob demanda |
| RAM flush (EmptyWorkingSet) | **Sim** | Elevacao sob demanda |
| WSL2 vhdx compaction | **Sim** | Elevacao sob demanda |
| Gaming Mode (service disable) | **Sim** | Elevacao sob demanda |

**Estrategia de Elevacao:**

O app inicia **sem** privilegios admin. Quando uma operacao requer elevacao, o backend verifica `is_elevated()` e, se falso, retorna um erro tipado `AppError::ElevationRequired { operation }`. O frontend exibe um dialog explicando por que admin e necessario e oferece um botao "Executar como Admin". Ao clicar, o frontend invoca `invoke("request_elevation")` que usa `ShellExecuteW` com `runas` para re-lancar o app elevado. O estado da sessao (pagina atual, selecoes) e persistido em arquivo temp antes do re-lancamento.

[AUTO-DECISION] Usar re-lancamento do app inteiro vs helper elevado separado? -> Re-lancamento do app inteiro (reason: complexidade menor, projeto pessoal sem necessidade de UX ultra-polish. Helper separado adiciona IPC inter-processo que nao compensa para uso pessoal).

---

## 2. Estrutura do Projeto

```
windows-optimizer/
|
+-- src-tauri/                          # Rust backend (Tauri app)
|   +-- src/
|   |   +-- main.rs                     # Entry point, Tauri builder, plugin registration
|   |   +-- lib.rs                      # Crate root, module declarations
|   |   |
|   |   +-- commands/                   # Tauri command handlers (thin layer)
|   |   |   +-- mod.rs                  # Re-exports all command modules
|   |   |   +-- cache.rs               # Cache cleaning commands
|   |   |   +-- gpu.rs                 # GPU cache cleaning commands
|   |   |   +-- monitor.rs            # System monitoring commands
|   |   |   +-- services.rs           # Windows service management commands
|   |   |   +-- startup.rs            # Startup items management commands
|   |   |   +-- ram.rs                # RAM optimization commands
|   |   |   +-- disk.rs               # Disk optimization commands
|   |   |   +-- dev_cleaner.rs        # Developer Mode cleaning commands
|   |   |   +-- gaming.rs             # Gaming Mode commands
|   |   |   +-- presets.rs            # Presets and profiles commands
|   |   |   +-- system.rs             # App-level commands (elevation, config, logs)
|   |   |
|   |   +-- modules/                    # Business logic (domain layer)
|   |   |   +-- mod.rs
|   |   |   +-- cache_cleaner.rs       # Scan/clean system caches (FR-001 to FR-011)
|   |   |   +-- gpu_cleaner.rs         # GPU shader cache detection/clean (FR-012 to FR-017)
|   |   |   +-- service_manager.rs     # Service listing, classification, control (FR-018 to FR-025)
|   |   |   +-- startup_manager.rs     # Startup items from all sources (FR-026 to FR-029)
|   |   |   +-- ram_optimizer.rs       # Working set flush, process listing (FR-030 to FR-033)
|   |   |   +-- disk_optimizer.rs      # Disk detection, TRIM, defrag, analysis (FR-034 to FR-039)
|   |   |   +-- system_monitor.rs      # CPU, RAM, GPU, disk, net, temp monitoring (FR-040 to FR-048)
|   |   |   +-- dev_cleaner.rs         # Dev tool detection, cache scanning/cleaning (FR-053 to FR-062)
|   |   |   +-- gaming_mode.rs         # Gaming Mode lifecycle, snapshot/restore (FR-063 to FR-070)
|   |   |   +-- preset_manager.rs      # Presets, profiles, automation (FR-049 to FR-052)
|   |   |
|   |   +-- platform/                   # OS-level abstractions (thin wrappers over Windows APIs)
|   |   |   +-- mod.rs
|   |   |   +-- elevation.rs           # UAC detection, re-launch as admin
|   |   |   +-- filesystem.rs          # Directory scanning, size calculation, safe delete
|   |   |   +-- wmi_client.rs          # WMI connection pool, typed queries
|   |   |   +-- nvml.rs               # NVML initialization, device queries (GPU NVIDIA)
|   |   |   +-- registry.rs           # Registry read/write with backup
|   |   |   +-- services.rs           # Service Control Manager wrapper
|   |   |   +-- process.rs            # Process listing, priority, termination
|   |   |   +-- shell.rs              # Shell API (Recycle Bin, file dialogs)
|   |   |   +-- perf_counters.rs      # PDH (Performance Data Helper) wrapper
|   |   |   +-- thermal.rs            # Temperature sensors (WMI, sysinfo, NVML)
|   |   |   +-- disk_io.rs            # DeviceIoControl for TRIM, disk type detection
|   |   |   +-- task_scheduler.rs     # Windows Task Scheduler API
|   |   |
|   |   +-- config/                     # Configuration management
|   |   |   +-- mod.rs
|   |   |   +-- app_config.rs          # App preferences, thresholds, paths
|   |   |   +-- presets.rs             # Built-in and custom presets (Gaming, Dev, etc.)
|   |   |   +-- backup.rs             # Backup/restore engine for service/startup state
|   |   |
|   |   +-- state/                      # Application state (managed by Tauri)
|   |   |   +-- mod.rs
|   |   |   +-- app_state.rs           # Global app state (is_elevated, active_mode)
|   |   |   +-- monitor_buffer.rs      # Ring buffer for historical metric data (24h)
|   |   |   +-- gaming_snapshot.rs     # System state snapshot for Gaming Mode restore
|   |   |
|   |   +-- error.rs                    # Unified error types (AppError enum)
|   |   +-- logging.rs                  # Structured logging to file
|   |
|   +-- Cargo.toml                      # Rust dependencies
|   +-- tauri.conf.json                 # Tauri configuration (window, capabilities, bundle)
|   +-- capabilities/                   # Tauri 2 capability files
|   |   +-- default.json               # Default window capabilities
|   +-- icons/                          # App icons
|   +-- build.rs                        # Build script (embed manifest for UAC)
|
+-- src/                                # React frontend
|   +-- main.tsx                        # React entry point
|   +-- App.tsx                         # Root component, router setup
|   +-- vite-env.d.ts                   # Vite type declarations
|   |
|   +-- components/                     # Shared UI components
|   |   +-- layout/
|   |   |   +-- Sidebar.tsx            # Navigation sidebar (fixed)
|   |   |   +-- AppShell.tsx           # Main layout wrapper (sidebar + content)
|   |   |   +-- PageHeader.tsx         # Page title + breadcrumb
|   |   +-- feedback/
|   |   |   +-- ConfirmDialog.tsx      # Confirmation modal (scan-preview-confirm)
|   |   |   +-- ProgressOverlay.tsx    # Operation progress with steps
|   |   |   +-- AlertBanner.tsx        # Temperature/warning alerts
|   |   |   +-- Toast.tsx              # Non-blocking notifications
|   |   +-- data/
|   |   |   +-- MetricCard.tsx         # Single metric display (CPU %, RAM GB, etc.)
|   |   |   +-- MetricChart.tsx        # Real-time line chart wrapper (Recharts)
|   |   |   +-- DataTable.tsx          # Generic sortable/filterable table
|   |   |   +-- CategoryCheckList.tsx  # Checkboxes for cache categories
|   |   |   +-- DiskUsageBar.tsx       # Colored disk usage bar
|   |   +-- common/
|   |       +-- Button.tsx             # Styled button variants
|   |       +-- Toggle.tsx             # Toggle switch (services, startup)
|   |       +-- Badge.tsx              # Status badges (SAFE, CAUTION, DANGEROUS)
|   |       +-- Tooltip.tsx            # Info tooltips
|   |
|   +-- pages/                          # Route pages (one per module)
|   |   +-- Dashboard.tsx              # Home page — live metrics overview
|   |   +-- CacheCleaner.tsx           # System cache scan/clean
|   |   +-- GpuCacheCleaner.tsx        # GPU shader cache scan/clean
|   |   +-- DeveloperMode.tsx          # Dev tools cache scan/clean
|   |   +-- GamingMode.tsx             # Gaming mode toggle + config
|   |   +-- ServiceManager.tsx         # Windows services list/control
|   |   +-- StartupManager.tsx         # Startup items list/control
|   |   +-- RamOptimizer.tsx           # Process list, RAM flush
|   |   +-- DiskOptimizer.tsx          # Disk analysis, TRIM, defrag
|   |   +-- Settings.tsx               # App settings, thresholds, logs viewer
|   |
|   +-- hooks/                          # Custom React hooks
|   |   +-- useSystemMetrics.ts        # Subscribe to system-metrics events
|   |   +-- useInvoke.ts              # Typed wrapper around Tauri invoke
|   |   +-- useConfirm.ts             # Confirmation dialog state
|   |   +-- useElevation.ts           # Check/request admin elevation
|   |
|   +-- stores/                         # Zustand state stores
|   |   +-- metricsStore.ts           # Real-time metrics (CPU, RAM, GPU, temps)
|   |   +-- cleanerStore.ts           # Cache scan results, selections
|   |   +-- settingsStore.ts          # App preferences (thresholds, paths)
|   |   +-- gamingStore.ts            # Gaming mode state
|   |
|   +-- types/                          # TypeScript type definitions
|   |   +-- ipc.ts                     # Types matching Rust serde structs
|   |   +-- metrics.ts                 # Monitoring data types
|   |   +-- cleaner.ts                # Cache scan/clean types
|   |   +-- services.ts               # Service/startup types
|   |
|   +-- lib/                            # Utility functions
|   |   +-- tauri.ts                   # Tauri invoke/listen helpers
|   |   +-- format.ts                 # Byte formatting, date formatting
|   |   +-- constants.ts              # Default thresholds, polling intervals
|   |
|   +-- styles/
|       +-- globals.css                # Tailwind directives + dark theme vars
|
+-- package.json                        # Frontend dependencies
+-- tsconfig.json                       # TypeScript configuration
+-- vite.config.ts                      # Vite bundler configuration
+-- tailwind.config.ts                  # Tailwind configuration (dark theme)
+-- index.html                          # HTML entry point
+-- .gitignore
+-- README.md
```

**Proposito de cada diretorio principal:**

| Diretorio | Proposito |
|-----------|-----------|
| `src-tauri/src/commands/` | **Camada de entrada.** Handlers Tauri `#[tauri::command]` que recebem input do frontend, validam parametros, delegam para `modules/`, e retornam `Result<T, AppError>`. Nenhuma logica de negocio aqui. |
| `src-tauri/src/modules/` | **Camada de negocio.** Toda a logica de dominio: scan de caches, classificacao de servicos, gaming mode lifecycle, etc. Nao conhece Tauri diretamente (recebe `AppHandle` apenas para emitir eventos). |
| `src-tauri/src/platform/` | **Camada de plataforma.** Wrappers finos sobre APIs Windows (WMI, NVML, Registry, SCM). Encapsula detalhes de FFI e conversao de tipos. Modules usam platform, nunca o contrario. |
| `src-tauri/src/config/` | **Configuracao.** Leitura/escrita de preferences, presets builtin, e engine de backup/restore de estado. |
| `src-tauri/src/state/` | **Estado de runtime.** AppState gerenciado pelo Tauri, buffers de metricas (ring buffer 24h), snapshot do Gaming Mode. |
| `src/components/` | **Componentes reutilizaveis.** Layout (sidebar, shell), feedback (dialogs, progress), data (charts, tables), common (buttons, toggles). |
| `src/pages/` | **Paginas de rota.** Uma por modulo funcional. Cada pagina compoe componentes e hooks. |
| `src/stores/` | **Estado global.** Zustand stores para metricas, resultados de scan, settings, gaming mode. |
| `src/types/` | **Tipos TypeScript.** Espelham exatamente as structs Rust serializadas via serde. Source of truth no Rust, TS segue. |

---

## 3. Crates Rust

### 3.1 Dependencias Externas

| Crate | Versao | Responsabilidade | Usada por | Notas |
|-------|--------|-----------------|-----------|-------|
| `tauri` | 2.x | Framework principal: IPC, window mgmt, events, state | main.rs, commands/* | Core do app |
| `tauri-build` | 2.x | Build-time: embed manifest, icon | build.rs | Build dependency |
| `serde` | 1.x | Serialization/deserialization (derive) | Todos | `features = ["derive"]` |
| `serde_json` | 1.x | JSON serialization para configs e IPC | config/*, commands/* | |
| `tokio` | 1.x | Async runtime para monitor loops e scheduler | services/*, modules/monitor | `features = ["full"]` |
| `sysinfo` | 0.32+ | CPU, RAM, disco, processos, componentes | modules/system_monitor, platform/* | Cross-platform mas usamos apenas Win |
| `nvml-wrapper` | 0.10+ | NVIDIA GPU: temp, clock, VRAM, utilization | platform/nvml, modules/gpu_cleaner | Requer NVIDIA driver instalado |
| `windows` | 0.58+ | Win32 API bindings (Microsoft oficial) | platform/* | `features` por API usada |
| `wmi` | 0.14+ | WMI queries tipadas | platform/wmi_client | Para servicos, hardware, thermal |
| `winreg` | 0.52+ | Windows Registry read/write | platform/registry | Para startup items, gaming mode |
| `chrono` | 0.4+ | Timestamps para logs e historico | logging, config/backup | |
| `thiserror` | 2.x | Derive para error types | error.rs | Ergonomia de erros |
| `tracing` | 0.1+ | Structured logging | logging.rs, todos os modulos | Com `tracing-subscriber` + file appender |
| `tracing-subscriber` | 0.3+ | Log subscriber com file output | logging.rs | |
| `tracing-appender` | 0.2+ | Rolling file appender para logs | logging.rs | Rotacao por tamanho/data |
| `walkdir` | 2.x | Recursive directory traversal | modules/cache_cleaner, disk_optimizer | Para scan de caches e disk analysis |
| `sha2` | 0.10+ | SHA-256 hashing | modules/disk_optimizer | Para deteccao de duplicados (v1.0) |
| `directories` | 5.x | Standard dirs (%APPDATA%, %LOCALAPPDATA%) | config/app_config | Platform-aware paths |

### 3.2 Feature Flags do `windows` crate

O `windows` crate e enorme. Listar apenas as features necessarias no `Cargo.toml`:

```toml
[dependencies.windows]
version = "0.58"
features = [
    # Elevation / Shell
    "Win32_UI_Shell",                           # ShellExecuteW, SHEmptyRecycleBin
    "Win32_Security",                           # TOKEN_ELEVATION, OpenProcessToken
    # Services
    "Win32_System_Services",                    # OpenSCManager, ChangeServiceConfig
    # Process
    "Win32_System_Threading",                   # OpenProcess, SetPriorityClass, TerminateProcess
    "Win32_System_ProcessStatus",               # EmptyWorkingSet
    # Memory
    "Win32_System_SystemInformation",           # GlobalMemoryStatusEx
    # Disk
    "Win32_System_IO",                          # DeviceIoControl (TRIM)
    "Win32_System_Ioctl",                       # IOCTL constants
    "Win32_Storage_FileSystem",                 # Disk type detection
    # Performance
    "Win32_System_Performance",                 # PDH counters
    # Task Scheduler
    "Win32_System_TaskScheduler",               # ITaskService, ITaskFolder
]
```

### 3.3 Modulos Internos do Crate

```
src-tauri/src/
    lib.rs  -->  pub mod commands;
                 pub mod modules;
                 pub mod platform;
                 pub mod config;
                 pub mod state;
                 pub mod error;
                 pub mod logging;
```

Cada modulo interno esta descrito na secao 4.

---

## 4. Modulos do Backend (Rust)

### 4.1 Modulo: cache_cleaner

**Responsabilidade:** Scan e limpeza de caches do sistema operacional (temp files, browser cache, Update cache, Prefetch, Recycle Bin, etc.).

**Interface:**

```rust
pub struct CacheCleaner;

impl CacheCleaner {
    /// Scan all cache categories and return size estimates
    pub async fn scan(&self, categories: Option<Vec<CacheCategory>>) -> Result<ScanResult, AppError>;

    /// Clean selected categories, emitting progress events
    pub async fn clean(
        &self,
        app: &AppHandle,
        categories: Vec<CacheCategory>,
    ) -> Result<CleanResult, AppError>;

    /// List detected browsers with cache paths
    pub fn detect_browsers(&self) -> Vec<BrowserInfo>;
}

pub enum CacheCategory {
    UserTemp,
    WindowsTemp,        // requires admin
    WindowsUpdate,      // requires admin
    Prefetch,           // requires admin
    BrowserChrome,
    BrowserEdge,
    BrowserFirefox,
    BrowserOpera,
    Thumbnails,
    DnsCache,           // requires admin
    WindowsInstaller,   // requires admin
    RecentFiles,
    RecycleBin,
}

pub struct ScanResult {
    pub categories: Vec<CategoryScanResult>,
    pub total_size_bytes: u64,
}

pub struct CategoryScanResult {
    pub category: CacheCategory,
    pub size_bytes: u64,
    pub file_count: u32,
    pub requires_admin: bool,
    pub warning: Option<String>,  // e.g., "Browser is currently open"
}
```

**Tauri Commands Expostos:**

| Command | Parametros | Retorno | Permissao |
|---------|-----------|---------|-----------|
| `scan_system_cache` | `categories: Option<Vec<String>>` | `ScanResult` | User (parcial) |
| `clean_system_cache` | `categories: Vec<String>` | `CleanResult` | User/Admin |
| `detect_browsers` | nenhum | `Vec<BrowserInfo>` | User |

**Dependencias:** `platform::filesystem`, `platform::elevation`, `platform::shell` (RecycleBin)

**Nivel de Permissao:** Misto. Categorias de usuario nao precisam. WindowsTemp, Prefetch, Update, DNS, Installer requerem admin.

**Riscos Tecnicos:**
- Arquivos em uso (locked) durante limpeza: catch silencioso, reportar no resultado.
- Browser aberto impede limpeza de cache: detectar processo, avisar usuario.

---

### 4.2 Modulo: gpu_cleaner

**Responsabilidade:** Deteccao de GPU e limpeza de shader caches NVIDIA, AMD e DirectX.

**Interface:**

```rust
pub struct GpuCleaner {
    nvml: Option<NvmlWrapper>,  // None if NVIDIA not available
}

impl GpuCleaner {
    pub fn new() -> Self;

    /// Detect installed GPUs
    pub fn detect_gpus(&self) -> Vec<GpuInfo>;

    /// Scan all GPU shader cache directories
    pub fn scan_shader_caches(&self) -> Result<GpuScanResult, AppError>;

    /// Clean selected shader caches
    pub async fn clean_shader_caches(
        &self,
        app: &AppHandle,
        targets: Vec<ShaderCacheTarget>,
    ) -> Result<CleanResult, AppError>;
}

pub struct GpuInfo {
    pub vendor: GpuVendor,          // NVIDIA, AMD, Intel
    pub name: String,               // e.g., "NVIDIA GeForce RTX 4080"
    pub driver_version: String,
    pub vram_mb: u64,
}

pub enum ShaderCacheTarget {
    NvidiaDxCache,
    NvidiaGlCache,
    NvidiaNvCache,
    AmdDxCache,
    AmdGlCache,
    DirectXShaderCache,
    IntelShaderCache,      // v1.0
    SteamShaderCache,      // v1.0
    VulkanPipelineCache,   // v1.0
}
```

**Tauri Commands Expostos:**

| Command | Parametros | Retorno | Permissao |
|---------|-----------|---------|-----------|
| `detect_gpus` | nenhum | `Vec<GpuInfo>` | User |
| `scan_shader_caches` | nenhum | `GpuScanResult` | User |
| `clean_shader_caches` | `targets: Vec<String>` | `CleanResult` | User |

**Dependencias:** `platform::nvml`, `platform::wmi_client` (AMD/Intel detection), `platform::filesystem`

**Nivel de Permissao:** User-level. Todos os shader caches estao em `%LOCALAPPDATA%`.

**Riscos Tecnicos:**
- NVML indisponivel se driver NVIDIA ausente: graceful degradation, `nvml` field = None.
- AMD detection apenas via WMI (sem crate dedicada): funcional para info basica.

---

### 4.3 Modulo: service_manager

**Responsabilidade:** Listar, classificar, controlar servicos Windows e gerenciar backups de estado.

**Interface:**

```rust
pub struct ServiceManager;

impl ServiceManager {
    /// List all Windows services with classification
    pub async fn list_services(&self) -> Result<Vec<ServiceInfo>, AppError>;

    /// Change service startup type
    pub fn set_service_startup(
        &self,
        service_name: &str,
        startup_type: ServiceStartupType,
    ) -> Result<(), AppError>;

    /// Start or stop a service
    pub fn control_service(
        &self,
        service_name: &str,
        action: ServiceAction,
    ) -> Result<(), AppError>;

    /// Create backup of current service state
    pub fn backup_services_state(&self) -> Result<BackupInfo, AppError>;

    /// Restore from a saved backup
    pub fn restore_services_state(&self, backup_id: &str) -> Result<RestoreResult, AppError>;

    /// Apply a named preset (Gamer, Developer, Minimal, Default)
    pub fn apply_preset(&self, preset: &ServicePreset) -> Result<PresetApplyResult, AppError>;

    /// Preview what a preset would change (diff)
    pub fn preview_preset(&self, preset: &ServicePreset) -> Result<PresetDiff, AppError>;
}

pub struct ServiceInfo {
    pub name: String,
    pub display_name: String,
    pub status: ServiceStatus,           // Running, Stopped, Paused
    pub startup_type: ServiceStartupType, // Auto, Manual, Disabled
    pub classification: ServiceClassification, // Safe, Caution, Dangerous
    pub description: String,
    pub category: ServiceCategory,       // Telemetry, Legacy, System, UserApp
}

pub enum ServiceClassification {
    Safe,       // Can freely disable (telemetry, legacy)
    Caution,    // Needs confirmation (Print Spooler, Bluetooth, Xbox)
    Dangerous,  // BLOCKED from disabling (Windows Update, Defender, RPC)
}
```

**Tauri Commands Expostos:**

| Command | Parametros | Retorno | Permissao |
|---------|-----------|---------|-----------|
| `list_services` | nenhum | `Vec<ServiceInfo>` | User |
| `set_service_startup` | `name, startup_type` | `()` | **Admin** |
| `control_service` | `name, action` | `()` | **Admin** |
| `backup_services_state` | nenhum | `BackupInfo` | **Admin** |
| `restore_services_state` | `backup_id` | `RestoreResult` | **Admin** |
| `preview_preset` | `preset_name` | `PresetDiff` | User |
| `apply_preset` | `preset_name` | `PresetApplyResult` | **Admin** |

**Dependencias:** `platform::services`, `platform::wmi_client`, `config::backup`, `config::presets`

**Nivel de Permissao:** Listagem = User. Todas as modificacoes = Admin.

**Riscos Tecnicos:**
- **CRITICO (R-006):** Desativacao de servicos errados pode causar instabilidade. Mitigacao: servicos `Dangerous` sao HARD BLOCKED no codigo (nao apenas na UI). A lista de classificacao e hardcoded no Rust, nao vem do frontend.
- Backup deve ser atomico: gravar em arquivo temp e renomear.

---

### 4.4 Modulo: startup_manager

**Responsabilidade:** Gerenciar itens de inicializacao de todas as fontes (Registry, Startup folder, Task Scheduler).

**Interface:**

```rust
pub struct StartupManager;

impl StartupManager {
    /// List all startup items from all sources
    pub async fn list_startup_items(&self) -> Result<Vec<StartupItem>, AppError>;

    /// Enable/disable a startup item
    pub fn set_startup_enabled(
        &self,
        item_id: &str,
        enabled: bool,
    ) -> Result<(), AppError>;

    /// Estimate impact of a startup item
    pub fn estimate_impact(&self, item_id: &str) -> Result<StartupImpact, AppError>;

    /// Get change history
    pub fn get_history(&self) -> Result<Vec<StartupChangeEntry>, AppError>;
}

pub struct StartupItem {
    pub id: String,                        // Unique identifier
    pub name: String,
    pub source: StartupSource,             // RegistryHKCU, RegistryHKLM, Folder, TaskScheduler
    pub path: String,                      // Executable path
    pub enabled: bool,
    pub requires_admin: bool,              // true for HKLM, TaskScheduler
    pub impact_estimate: Option<ImpactLevel>, // Low, Medium, High
}
```

**Tauri Commands:** `list_startup_items`, `set_startup_enabled`, `estimate_startup_impact`, `get_startup_history`

**Dependencias:** `platform::registry`, `platform::task_scheduler`, `platform::filesystem`, `config::backup`

**Nivel de Permissao:** Listagem = User. Toggle HKCU = User. Toggle HKLM/TaskScheduler = Admin.

**Riscos Tecnicos:**
- Task Scheduler COM API e complexa: usar `windows` crate com ITaskService interface.
- Items de startup podem ter paths invalidos (app desinstalado): detectar e marcar.

---

### 4.5 Modulo: ram_optimizer

**Responsabilidade:** Monitoramento de processos pesados, flush de working sets, kill de processos.

**Interface:**

```rust
pub struct RamOptimizer;

impl RamOptimizer {
    /// List top N processes by RAM usage
    pub fn list_heavy_processes(&self, top_n: usize) -> Result<Vec<ProcessInfo>, AppError>;

    /// Flush working sets of idle processes
    pub fn flush_working_sets(&self) -> Result<FlushResult, AppError>;

    /// Clean standby list
    pub fn clean_standby_list(&self) -> Result<u64, AppError>; // bytes freed

    /// Kill process by PID
    pub fn kill_process(&self, pid: u32) -> Result<(), AppError>;
}

pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub working_set_bytes: u64,
    pub private_bytes: u64,
    pub cpu_percent: f32,
    pub is_system: bool,      // Protected from kill/flush
}
```

**Tauri Commands:** `list_heavy_processes`, `flush_working_sets`, `clean_standby_list`, `kill_process`

**Dependencias:** `platform::process`, `sysinfo`

**Nivel de Permissao:** Listagem = User. Flush/kill = Admin.

**Riscos Tecnicos:**
- **R-005:** EmptyWorkingSet agressivo pode degradar performance. Mitigacao: cooldown de 5 minutos entre flushes, excluir processos do sistema, exibir aviso honesto (CON-010).
- Kill de processos do sistema pode causar crash: flag `is_system` previne.

---

### 4.6 Modulo: disk_optimizer

**Responsabilidade:** Deteccao de tipo de disco, TRIM, desfrag, analise de espaco, arquivos grandes/duplicados.

**Interface:**

```rust
pub struct DiskOptimizer;

impl DiskOptimizer {
    /// List all physical disks with type detection
    pub fn list_disks(&self) -> Result<Vec<DiskInfo>, AppError>;

    /// Execute TRIM on SSD
    pub fn trim_ssd(&self, drive: &str) -> Result<(), AppError>;

    /// Execute defrag on HDD
    pub async fn defrag_hdd(&self, app: &AppHandle, drive: &str) -> Result<(), AppError>;

    /// Scan disk for space analysis (treemap data)
    pub async fn analyze_space(
        &self,
        app: &AppHandle,
        path: &str,
        max_depth: u32,
    ) -> Result<DiskTreeNode, AppError>;

    /// Find large files above threshold
    pub async fn find_large_files(
        &self,
        path: &str,
        threshold_bytes: u64,
    ) -> Result<Vec<LargeFile>, AppError>;

    /// Find duplicate files by hash (v1.0)
    pub async fn find_duplicates(
        &self,
        path: &str,
    ) -> Result<Vec<DuplicateGroup>, AppError>;
}
```

**Tauri Commands:** `list_disks`, `trim_ssd`, `defrag_hdd`, `analyze_disk_space`, `find_large_files`, `find_duplicates`

**Dependencias:** `platform::disk_io`, `platform::wmi_client`, `platform::filesystem`, `walkdir`, `sha2`

**Nivel de Permissao:** Listagem/analise = User. TRIM/defrag = Admin.

**Riscos Tecnicos:**
- TRIM em disco que nao e SSD: verificacao obrigatoria antes de executar.
- Treemap scan de discos grandes (R-010): limitar profundidade, scan em thread separada com cancelamento, lazy loading na UI.

---

### 4.7 Modulo: system_monitor

**Responsabilidade:** Monitoramento em tempo real de CPU, RAM, GPU, disco I/O, rede, e temperaturas. Loop em background emitindo eventos.

**Interface:**

```rust
pub struct SystemMonitor {
    sys: sysinfo::System,
    nvml: Option<NvmlWrapper>,
    buffer: Arc<Mutex<MonitorBuffer>>,
}

impl SystemMonitor {
    pub fn new(nvml: Option<NvmlWrapper>) -> Self;

    /// Start background monitoring loop (called once at app startup)
    pub fn start_monitoring(
        &self,
        app: AppHandle,
        interval: Duration,
    ) -> tokio::task::JoinHandle<()>;

    /// Stop monitoring loop
    pub fn stop_monitoring(&self);

    /// Get current snapshot (on-demand, for commands)
    pub fn get_current_metrics(&self) -> Result<SystemMetrics, AppError>;

    /// Get hardware info (static, queried once)
    pub fn get_hardware_info(&self) -> Result<HardwareInfo, AppError>;

    /// Get temperature history from buffer
    pub fn get_temperature_history(
        &self,
        sensor: &str,
        duration: Duration,
    ) -> Result<Vec<TimestampedValue>, AppError>;
}

pub struct SystemMetrics {
    pub timestamp: i64,
    pub cpu: CpuMetrics,
    pub ram: RamMetrics,
    pub gpu: Option<GpuMetrics>,       // None if no supported GPU
    pub disks: Vec<DiskMetrics>,
    pub network: Vec<NetworkMetrics>,
    pub temperatures: TemperatureMetrics,
}

pub struct CpuMetrics {
    pub total_usage_percent: f32,
    pub frequency_mhz: u64,
    pub per_core_usage: Vec<f32>,
    pub core_count: u32,
    pub thread_count: u32,
}

pub struct TemperatureMetrics {
    pub cpu_temp_c: Option<f32>,
    pub gpu_temp_c: Option<f32>,
    pub disk_temps_c: Vec<(String, f32)>,    // (disk_name, temp)
    pub motherboard_temp_c: Option<f32>,
}
```

**Tauri Commands:**

| Command | Parametros | Retorno | Permissao |
|---------|-----------|---------|-----------|
| `get_current_metrics` | nenhum | `SystemMetrics` | User |
| `get_hardware_info` | nenhum | `HardwareInfo` | User |
| `get_temperature_history` | `sensor, duration_secs` | `Vec<TimestampedValue>` | User |

**Eventos emitidos:**

| Evento | Payload | Intervalo |
|--------|---------|-----------|
| `system-metrics` | `SystemMetrics` | 2s (configurable) |
| `temperature-alert` | `{ sensor, temp, threshold }` | On threshold breach |

**Dependencias:** `sysinfo`, `platform::nvml`, `platform::wmi_client`, `platform::perf_counters`, `platform::thermal`, `state::monitor_buffer`

**Nivel de Permissao:** User para a maioria. CPU temperature via WMI ThermalZone requer Admin (com fallback para sysinfo).

**Riscos Tecnicos:**
- **R-002:** WMI ThermalZone pode ser impreciso ou indisponivel. Fallback chain: WMI -> sysinfo -> "N/A".
- **R-008:** Muitos PDH counters simultaneos. Limitar a counters essenciais, intervalo 2s.
- Thread model: o monitor loop roda em `tokio::spawn` com `sysinfo::System` refreshado a cada tick. `sysinfo::System` NAO e Send, entao deve viver na mesma task.

---

### 4.8 Modulo: dev_cleaner

**Responsabilidade:** Deteccao de ferramentas de desenvolvimento e limpeza de caches especificos de desenvolvimento.

**Interface:**

```rust
pub struct DevCleaner;

impl DevCleaner {
    /// Detect which dev tools are installed
    pub fn detect_dev_tools(&self) -> Result<Vec<DevToolInfo>, AppError>;

    /// Scan all detected dev caches
    pub async fn scan_dev_caches(
        &self,
        app: &AppHandle,
        scan_dirs: Vec<String>,  // directories to scan for orphan node_modules
    ) -> Result<DevScanResult, AppError>;

    /// Clean selected dev caches
    pub async fn clean_dev_caches(
        &self,
        app: &AppHandle,
        targets: Vec<DevCacheTarget>,
    ) -> Result<CleanResult, AppError>;

    /// Compact WSL2 vhdx
    pub async fn compact_wsl2_vhdx(
        &self,
        distro: &str,
    ) -> Result<CompactionResult, AppError>;
}

pub enum DevCacheTarget {
    OrphanNodeModules(Vec<String>),  // paths to delete
    NpmCache,
    YarnCache,
    PnpmCache,
    PipCache,
    CargoCache,
    GoModuleCache,
    MavenCache,
    GradleCache,
    DockerPrune,
    Wsl2Compact(String),  // distro name
}
```

**Tauri Commands:** `detect_dev_tools`, `scan_dev_caches`, `clean_dev_caches`, `compact_wsl2_vhdx`

**Dependencias:** `platform::filesystem`, `platform::process` (para executar docker, wsl CLI), `walkdir`

**Nivel de Permissao:** Maioria User. WSL2 compaction = Admin.

**Riscos Tecnicos:**
- **R-012:** Docker CLI indisponivel: feature desabilitada com mensagem informativa.
- **R-013:** WSL2 shutdown durante compactacao: aviso proeminente, listar distros ativas, confirmacao obrigatoria.
- Scan recursivo de node_modules pode ser lento em discos grandes: executar em thread separada, emitir progresso, permitir cancelamento.

---

### 4.9 Modulo: gaming_mode

**Responsabilidade:** Gaming Mode lifecycle — snapshot, ativacao (services, shader cache, RAM, prioridade), desativacao com restauracao.

**Interface:**

```rust
pub struct GamingMode {
    snapshot: Option<GamingSnapshot>,
    active: bool,
}

impl GamingMode {
    /// Activate Gaming Mode: snapshot state, apply optimizations
    pub async fn activate(
        &mut self,
        app: &AppHandle,
        config: &GamingModeConfig,
        service_mgr: &ServiceManager,
        gpu_cleaner: &GpuCleaner,
        ram_optimizer: &RamOptimizer,
    ) -> Result<GamingActivateResult, AppError>;

    /// Deactivate Gaming Mode: restore everything from snapshot
    pub async fn deactivate(
        &mut self,
        app: &AppHandle,
        service_mgr: &ServiceManager,
    ) -> Result<GamingDeactivateResult, AppError>;

    /// Check if gaming mode was left active after crash (recovery check)
    pub fn check_recovery_needed(&self) -> Option<GamingSnapshot>;

    /// Set process priority for game executable
    pub fn set_game_priority(&self, pid: u32, priority: ProcessPriority) -> Result<(), AppError>;

    /// Watch for game process start/stop (auto-activate)
    pub fn start_game_watcher(
        &self,
        app: AppHandle,
        game_exes: Vec<String>,
    ) -> tokio::task::JoinHandle<()>;
}

pub struct GamingModeConfig {
    pub services_to_disable: Vec<String>,
    pub clean_shader_cache: bool,
    pub flush_ram: bool,
    pub game_exe: Option<String>,
    pub game_priority: ProcessPriority,
    pub disable_game_dvr: bool,
}

pub struct GamingSnapshot {
    pub timestamp: i64,
    pub services_state: Vec<(String, ServiceStartupType, ServiceStatus)>,
    pub game_dvr_values: Vec<(String, u32)>,  // registry key, original value
    pub active: bool,                          // persisted to disk for crash recovery
}
```

**Tauri Commands:** `activate_gaming_mode`, `deactivate_gaming_mode`, `check_gaming_recovery`, `configure_gaming_mode`, `list_game_profiles`, `set_game_priority`

**Dependencias:** `modules::service_manager`, `modules::gpu_cleaner`, `modules::ram_optimizer`, `platform::registry`, `platform::process`, `state::gaming_snapshot`

**Nivel de Permissao:** Admin (disabling services, setting process priority, registry writes).

**Riscos Tecnicos:**
- **R-014 (CRITICO):** Crash durante Gaming Mode ativo. Mitigacao: snapshot persistido em arquivo JSON independente (`gaming_snapshot.json` no data dir). Ao iniciar app, verifica se existe snapshot ativo e oferece restauracao.
- **R-006:** Servicos desabilitados errados. Mitigacao: Gaming Mode usa a mesma classificacao do service_manager. Servicos DANGEROUS sao bloqueados. Lista default e curada.
- Transicao rapida (ativar/desativar/ativar): prevenir re-entrancia com mutex.

---

### 4.10 Modulo: preset_manager

**Responsabilidade:** Presets globais, perfis customizados, scheduler de tarefas, one-click optimize.

**Interface:**

```rust
pub struct PresetManager;

impl PresetManager {
    /// List available presets (builtin + custom)
    pub fn list_presets(&self) -> Result<Vec<PresetInfo>, AppError>;

    /// Apply a global preset
    pub async fn apply_preset(
        &self,
        app: &AppHandle,
        preset_name: &str,
    ) -> Result<PresetApplyResult, AppError>;

    /// Create custom profile
    pub fn create_profile(&self, profile: CustomProfile) -> Result<(), AppError>;

    /// Schedule recurring cleanup
    pub fn schedule_cleanup(&self, schedule: CleanupSchedule) -> Result<(), AppError>;

    /// One-click optimize (execute all active optimizations)
    pub async fn one_click_optimize(
        &self,
        app: &AppHandle,
    ) -> Result<OptimizeResult, AppError>;
}
```

**Tauri Commands:** `list_presets`, `apply_preset`, `create_profile`, `schedule_cleanup`, `one_click_optimize`

**Dependencias:** `modules::cache_cleaner`, `modules::gpu_cleaner`, `modules::service_manager`, `modules::ram_optimizer`, `config::presets`

**Nivel de Permissao:** Admin (modifies services, startup).

**Riscos Tecnicos:** Scheduler complexidade. Usar Windows Task Scheduler API para agendar execucao, nao manter o app rodando em background.

---

### 4.11 Modulos Transversais

#### error.rs

```rust
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum AppError {
    #[error("Elevation required for: {operation}")]
    ElevationRequired { operation: String },

    #[error("Service '{name}' is classified as DANGEROUS and cannot be modified")]
    DangerousService { name: String },

    #[error("NVML not available: {reason}")]
    NvmlUnavailable { reason: String },

    #[error("WMI query failed: {query}")]
    WmiError { query: String, source: String },

    #[error("File operation failed: {path}")]
    FileError { path: String, source: String },

    #[error("Process not found: PID {pid}")]
    ProcessNotFound { pid: u32 },

    #[error("Feature not available: {feature} ({reason})")]
    FeatureUnavailable { feature: String, reason: String },

    #[error("Operation cancelled by user")]
    Cancelled,

    #[error("Internal error: {0}")]
    Internal(String),
}
```

#### state/app_state.rs

```rust
pub struct AppState {
    pub is_elevated: bool,
    pub gaming_mode_active: bool,
    pub monitor_running: bool,
    pub data_dir: PathBuf,        // %APPDATA%\WindowsOptimizer\
    pub log_dir: PathBuf,         // %APPDATA%\WindowsOptimizer\logs\
    pub backup_dir: PathBuf,      // %APPDATA%\WindowsOptimizer\backups\
    pub config_path: PathBuf,     // %APPDATA%\WindowsOptimizer\config.json
}
```

Para modo portable (NFR-011): se detectar arquivo `portable.marker` na pasta do executavel, usar `./data/` ao inves de `%APPDATA%`.

---

## 5. Frontend (React/TypeScript)

### 5.1 Paginas e Rotas

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/` | `Dashboard` | Hub central com metricas real-time (CPU, RAM, GPU, temps, discos) |
| `/cache` | `CacheCleaner` | Scan/preview/clean de system caches |
| `/gpu` | `GpuCacheCleaner` | Deteccao GPU, shader cache scan/clean |
| `/developer` | `DeveloperMode` | Dev tools detection, cache scan/clean |
| `/gaming` | `GamingMode` | Toggle gaming mode, game profiles, config |
| `/services` | `ServiceManager` | Service list, classification, presets, backup/restore |
| `/startup` | `StartupManager` | Startup items, toggle enable/disable |
| `/ram` | `RamOptimizer` | Process list, RAM flush |
| `/disk` | `DiskOptimizer` | Disk analysis treemap, TRIM, defrag, large files |
| `/settings` | `Settings` | Preferences, thresholds, log viewer |

### 5.2 Componentes Compartilhados

**Layout Components:**
- `AppShell` — Container principal com Sidebar fixa (200px) + content area
- `Sidebar` — Navegacao vertical com icones e labels. Destaque visual no item ativo. Badge para alertas (ex: temperaturas altas)
- `PageHeader` — Titulo da pagina + acoes contextuais

**Feedback Components:**
- `ConfirmDialog` — Modal para o pattern scan-preview-confirm. Exibe lista do que sera feito, espaco afetado, botoes Confirmar/Cancelar. Para operacoes DANGEROUS: dupla confirmacao (checkbox "Entendo os riscos")
- `ProgressOverlay` — Overlay durante operacoes longas. Steps numerados com status (pendente/rodando/completo). Barra de progresso total
- `AlertBanner` — Alerta de temperatura fixo no topo quando threshold ultrapassado. Borda vermelha pulsante
- `Toast` — Notificacoes nao-bloqueantes (sucesso, info, erro)

**Data Components:**
- `MetricCard` — Card com label, valor grande, unidade, trend indicator (up/down/stable). Cor contextual (verde/amarelo/vermelho para thresholds)
- `MetricChart` — Wrapper sobre Recharts `LineChart` para series temporais real-time. Props: data array, max points (60 = 2min com 2s interval), y-axis config
- `DataTable` — Tabela generica com sort, filter. Usada em services, startup, processes, large files
- `CategoryCheckList` — Lista de checkboxes com tamanho por categoria. Select All/Deselect All. Usado em cache cleaner, gpu cleaner, dev cleaner
- `DiskUsageBar` — Barra horizontal colorida (verde/amarelo/vermelho) para uso de disco

### 5.3 Estado Global (Zustand)

[AUTO-DECISION] State management library? -> Zustand (reason: lightweight, zero boilerplate, TypeScript-friendly, já usado no tech preset nextjs-react do AIOX. Redux seria overkill para app local sem servidor.)

```typescript
// stores/metricsStore.ts
interface MetricsState {
  current: SystemMetrics | null;
  history: SystemMetrics[];     // Last 120 entries (4min at 2s interval)
  maxHistory: number;
  isMonitoring: boolean;

  // Actions
  pushMetrics: (m: SystemMetrics) => void;
  setMonitoring: (active: boolean) => void;
}

// stores/cleanerStore.ts
interface CleanerState {
  scanResult: ScanResult | null;
  selectedCategories: Set<string>;
  isScanning: boolean;
  isCleaning: boolean;
  cleanResult: CleanResult | null;

  // Actions
  setScanResult: (r: ScanResult) => void;
  toggleCategory: (cat: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

// stores/settingsStore.ts
interface SettingsState {
  thresholds: TemperatureThresholds;
  monitorInterval: number;    // ms
  scanDirs: string[];         // for dev mode node_modules scan
  preferences: AppPreferences;

  // Actions
  updateThreshold: (sensor: string, value: number) => void;
}

// stores/gamingStore.ts
interface GamingState {
  isActive: boolean;
  config: GamingModeConfig;
  gameProfiles: GameProfile[];
  lastActivation: Date | null;

  // Actions
  setActive: (active: boolean) => void;
  addGameProfile: (profile: GameProfile) => void;
}
```

### 5.4 Comunicacao com Backend (Tauri Invoke Pattern)

```typescript
// hooks/useInvoke.ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Typed invoke wrapper
export function useInvoke<T>(command: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async (args?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(command, args);
      setData(result);
      return result;
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      if (appError.type === 'ElevationRequired') {
        // Trigger elevation dialog
      }
      throw appError;
    } finally {
      setLoading(false);
    }
  }, [command]);

  return { data, error, loading, execute };
}

// hooks/useSystemMetrics.ts
export function useSystemMetrics() {
  const pushMetrics = useMetricsStore(s => s.pushMetrics);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<SystemMetrics>('system-metrics', (event) => {
        pushMetrics(event.payload);
      });
    };

    setup();
    return () => { unlisten?.(); };
  }, [pushMetrics]);
}
```

### 5.5 Dark Theme System

```css
/* styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0D1117;          /* GitHub dark bg */
  --bg-secondary: #161B22;        /* Card/sidebar bg */
  --bg-tertiary: #21262D;         /* Input/hover bg */
  --border: #30363D;              /* Borders */
  --text-primary: #E6EDF3;        /* Primary text */
  --text-secondary: #8B949E;      /* Secondary text */
  --accent-blue: #58A6FF;         /* Primary accent */
  --accent-cyan: #39D2C0;         /* Monitoring/temps */
  --accent-green: #3FB950;        /* Success/safe */
  --accent-yellow: #D29922;       /* Warning/caution */
  --accent-red: #F85149;          /* Error/danger/hot */
  --accent-purple: #BC8CFF;       /* GPU metrics */
}
```

Tailwind config usa essas variaveis como cores customizadas. Dark mode e o **unico** tema (sem toggle light/dark, conforme NFR-003).

### 5.6 Charts para Monitoramento

[AUTO-DECISION] Chart library? -> Recharts (reason: React-native, lightweight, bom suporte a line charts real-time, MIT license. Tremor e alternativa mais opinada mas adiciona dependencias de design system que nao precisamos. Chart.js via react-chartjs-2 tambem funciona mas Recharts tem melhor DX com React.)

**Uso dos graficos:**

| Contexto | Tipo de Grafico | Lib |
|----------|----------------|-----|
| CPU/RAM/GPU usage real-time | Line chart (area fill) | Recharts `AreaChart` |
| Temperature history | Line chart (multi-series) | Recharts `LineChart` |
| Disk usage por drive | Horizontal bar | Recharts `BarChart` ou custom CSS bar |
| Cache scan breakdown | Horizontal stacked bar | Recharts `BarChart` |
| Disk space treemap (v1.0) | Treemap | Recharts `Treemap` |
| Process RAM usage | Bar chart (horizontal) | Recharts `BarChart` |

**Configuracao para real-time:**
- Max data points por serie: 120 (= 4 minutos com intervalo 2s)
- Animation: desabilitada (`isAnimationActive={false}`) para performance
- Re-render: apenas quando novo data point chega (Zustand selector granular)

---

## 6. IPC -- Inter-Process Communication

### 6.1 Padrao de Comandos (invoke)

Comandos seguem request/response. O frontend invoca, o backend processa e retorna Result.

```
Frontend: invoke<ResponseType>("command_name", { arg1: value, arg2: value })
Backend:  #[tauri::command] async fn command_name(arg1: Type, arg2: Type) -> Result<ResponseType, AppError>
```

**Convencao de nomes:**
- Comandos: `snake_case` (Rust convention, Tauri serializa automaticamente)
- Argumentos: `snake_case` (serde rename se necessario)
- Prefixo por dominio: `scan_system_cache`, `clean_system_cache`, `detect_gpus`, `activate_gaming_mode`

**Registro no Tauri builder (main.rs):**

```rust
fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Cache
            commands::cache::scan_system_cache,
            commands::cache::clean_system_cache,
            commands::cache::detect_browsers,
            // GPU
            commands::gpu::detect_gpus,
            commands::gpu::scan_shader_caches,
            commands::gpu::clean_shader_caches,
            // Monitor
            commands::monitor::get_current_metrics,
            commands::monitor::get_hardware_info,
            commands::monitor::get_temperature_history,
            // Services
            commands::services::list_services,
            commands::services::set_service_startup,
            commands::services::control_service,
            commands::services::backup_services_state,
            commands::services::restore_services_state,
            commands::services::preview_preset,
            commands::services::apply_preset,
            // Startup
            commands::startup::list_startup_items,
            commands::startup::set_startup_enabled,
            // RAM
            commands::ram::list_heavy_processes,
            commands::ram::flush_working_sets,
            commands::ram::kill_process,
            // Disk
            commands::disk::list_disks,
            commands::disk::trim_ssd,
            commands::disk::analyze_disk_space,
            commands::disk::find_large_files,
            // Dev Cleaner
            commands::dev_cleaner::detect_dev_tools,
            commands::dev_cleaner::scan_dev_caches,
            commands::dev_cleaner::clean_dev_caches,
            commands::dev_cleaner::compact_wsl2_vhdx,
            // Gaming Mode
            commands::gaming::activate_gaming_mode,
            commands::gaming::deactivate_gaming_mode,
            commands::gaming::check_gaming_recovery,
            commands::gaming::configure_gaming_mode,
            // Presets
            commands::presets::list_presets,
            commands::presets::apply_preset,
            // System
            commands::system::request_elevation,
            commands::system::get_app_config,
            commands::system::save_app_config,
            commands::system::get_logs,
        ])
        .setup(|app| {
            // Initialize NVML (optional)
            let nvml = NvmlWrapper::try_new().ok();

            // Start monitoring loop
            let monitor = SystemMonitor::new(nvml);
            let handle = app.handle().clone();
            tokio::spawn(async move {
                monitor.start_monitoring(handle, Duration::from_secs(2)).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 6.2 Padrao de Eventos (emit/listen) — Streaming

Eventos sao push-based, do backend para o frontend. Usados para dados que atualizam continuamente.

| Evento | Payload | Emissor | Listener | Frequencia |
|--------|---------|---------|----------|-----------|
| `system-metrics` | `SystemMetrics` | `system_monitor` loop | `useSystemMetrics` hook | 2s |
| `temperature-alert` | `{ sensor, temp_c, threshold_c }` | `system_monitor` | `AlertBanner` | On breach |
| `cleanup-progress` | `{ step: string, current: u32, total: u32, pct: f32 }` | `cache_cleaner`, `gpu_cleaner`, `dev_cleaner` | `ProgressOverlay` | Per file/step |
| `defrag-progress` | `{ drive, pct: f32, status: string }` | `disk_optimizer` | `DiskOptimizer` page | Periodic |
| `gaming-mode-changed` | `{ active: bool, reason: string }` | `gaming_mode` | Sidebar badge, `GamingMode` page | On toggle |

### 6.3 Serializacao de Dados

**Rust (backend):** Todas as structs de interface usam `#[derive(Serialize, Deserialize)]` via serde. Enum variants sao serializados como strings (serde default) para facilitar match no TypeScript.

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // Rust snake_case -> TS camelCase
pub struct ScanResult {
    pub categories: Vec<CategoryScanResult>,
    pub total_size_bytes: u64,
}
```

**TypeScript (frontend):** Tipos espelham as structs Rust.

```typescript
// types/ipc.ts
interface ScanResult {
  categories: CategoryScanResult[];
  totalSizeBytes: number;
}

interface CategoryScanResult {
  category: string;
  sizeBytes: number;
  fileCount: number;
  requiresAdmin: boolean;
  warning: string | null;
}
```

**Regra: source of truth e o Rust.** Se a struct Rust muda, o type TS deve ser atualizado. Nao existe code generation automatica no MVP (considerar `ts-rs` crate para v1.0).

### 6.4 Error Handling entre Rust e TypeScript

Erros do backend chegam como rejeicao da Promise do `invoke()`.

```rust
// Backend: AppError serializa como JSON
{ "type": "ElevationRequired", "operation": "clean_system_cache" }
{ "type": "DangerousService", "name": "Windefend" }
```

```typescript
// Frontend: catch e parse
try {
  await invoke('clean_system_cache', { categories });
} catch (error: unknown) {
  const appError = error as { type: string; [key: string]: unknown };

  switch (appError.type) {
    case 'ElevationRequired':
      showElevationDialog(appError.operation as string);
      break;
    case 'DangerousService':
      showToast('error', `Service ${appError.name} cannot be modified`);
      break;
    default:
      showToast('error', `Operation failed: ${JSON.stringify(appError)}`);
  }
}
```

---

## 7. Seguranca

### 7.1 Elevation Pattern

```
App Start (User Mode)
    |
    +---> Funcoes que nao requerem admin funcionam normalmente
    |
    +---> Usuario solicita operacao admin (ex: limpar Windows Temp)
    |         |
    |         v
    |     Backend verifica is_elevated()
    |         |
    |         +---> Se ja elevado: executa direto
    |         |
    |         +---> Se nao elevado: retorna AppError::ElevationRequired
    |                   |
    |                   v
    |               Frontend exibe dialog:
    |               "Esta operacao requer privilegios de administrador.
    |                [Detalhes do que sera feito]
    |                [Executar como Admin] [Cancelar]"
    |                   |
    |                   v (se confirmar)
    |               invoke("request_elevation")
    |                   |
    |                   v
    |               Backend: ShellExecuteW("runas", app_exe, --restore-state)
    |                   |
    |                   v
    |               UAC prompt do Windows
    |                   |
    |                   v
    |               Novo processo do app como Admin
    |               Restaura estado da sessao (pagina, selecoes)
```

**Estado da sessao persistido:** Antes do re-lancamento, o app grava `session_state.json` (pagina atual, selecoes ativas, scan results em cache) no data dir. O novo processo le e restaura.

### 7.2 Capability Permissions (Tauri 2)

O Tauri 2 usa sistema de capabilities para controlar acesso ao IPC. Arquivo `capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:event:allow-listen",
    "core:event:allow-emit",
    "shell:allow-open",
    "dialog:default",
    "fs:allow-exists",
    "fs:allow-read-dir",
    "fs:allow-read-file",
    "process:allow-exit"
  ]
}
```

**Principio:** Nenhuma capability alem do necessario. Operacoes de sistema (services, registry, process) sao feitas via Rust direto, nao via plugins Tauri. O frontend nao tem acesso direto ao filesystem ou shell — tudo passa pelo IPC.

### 7.3 Sandboxing

- Frontend (WebView2) esta sandboxed por padrao no Tauri 2
- Acesso ao OS apenas via commands Rust registrados no invoke_handler
- Nenhum `shell:allow-execute` no capabilities — comandos CLI (docker, wsl, defrag) sao executados pelo Rust via `std::process::Command`
- Nenhum acesso direto a filesystem pelo frontend (apenas via commands)

### 7.4 Validacao de Inputs

**Backend (Rust):**
- Todos os paths recebidos do frontend sao validados contra path traversal (`..`, absolute paths fora do escopo)
- Service names sao validados contra lista conhecida antes de qualquer operacao
- PIDs sao verificados contra processos existentes
- Categorias de cache sao enums (nao strings abertas) — desserializacao falha se valor invalido

**Frontend (TypeScript):**
- File pickers usam dialog nativo do Tauri (nao input de texto livre para paths)
- Selecoes sao por checkbox/toggle (nao input de texto)
- Thresholds numericos validados com min/max

---

## 8. Testes

### 8.1 Estrategia de Testes Rust

**Unit Tests (por modulo):**

| Modulo | O que testar | Mock necessario? |
|--------|-------------|------------------|
| `cache_cleaner` | Logica de scan (quais paths, calculo de tamanho), selecao de categorias | Sim: `platform::filesystem` mockado |
| `gpu_cleaner` | Deteccao de vendor, mapeamento de paths por vendor | Sim: `platform::nvml` mockado |
| `service_manager` | Classificacao (SAFE/CAUTION/DANGEROUS), logica de preset diff | Sim: `platform::services` mockado |
| `startup_manager` | Merge de fontes (registry + folder + scheduler), dedup | Sim: `platform::registry` mockado |
| `gaming_mode` | Snapshot/restore lifecycle, crash recovery | Sim: `service_manager` mockado |
| `dev_cleaner` | Deteccao de ferramentas, heuristica de node_modules orfao | Sim: `platform::filesystem` mockado |
| `config/presets` | Serialization/deserialization de presets, merge logic | Nao |
| `state/monitor_buffer` | Ring buffer insert, history query, overflow | Nao |
| `error` | Serialization de AppError para JSON | Nao |

**Padrao de mock:** Usar traits para abstracoes de plataforma. Ex:

```rust
// platform/filesystem.rs
pub trait FileSystem: Send + Sync {
    fn scan_directory(&self, path: &Path) -> Result<DirScanResult, io::Error>;
    fn delete_directory(&self, path: &Path) -> Result<u64, io::Error>;
    fn get_directory_size(&self, path: &Path) -> Result<u64, io::Error>;
}

pub struct WindowsFileSystem;
impl FileSystem for WindowsFileSystem { /* real implementation */ }

#[cfg(test)]
pub struct MockFileSystem { /* configurable responses */ }
#[cfg(test)]
impl FileSystem for MockFileSystem { /* test responses */ }
```

**Integration Tests:**
- Testes que executam WMI queries reais, NVML queries reais, registry reads reais
- Marcados com `#[cfg(test)]` e `#[ignore]` por padrao (requerem ambiente Windows real)
- Executados manualmente em maquina de desenvolvimento antes de release

### 8.2 Estrategia de Testes Frontend

**Ferramentas:** Vitest + React Testing Library

**O que testar:**

| Camada | O que | Como |
|--------|-------|------|
| Components | Rendering, interaction (clicks, toggles) | React Testing Library |
| Hooks | useInvoke responses, useSystemMetrics event handling | Vitest com mock de `@tauri-apps/api` |
| Stores | State transitions, selectors | Vitest direto (Zustand e puro JS) |
| Pages | Integration dos componentes na pagina | React Testing Library com mocks de invoke |

**Mock do Tauri API:**

```typescript
// test/mocks/tauri.ts
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));
```

### 8.3 Testes de Operacoes Admin

Operacoes que requerem Admin (services, registry HKLM, TRIM, flush) **nao podem ser testadas em CI**. Estrategia:

1. **Unit tests com mocks** cobrem logica de negocio (classificacao, snapshot, diff)
2. **Integration tests manuais em VM** Windows antes de release
3. **Checklist manual de smoke test** para operacoes destrutivas:
   - [ ] Desativar servico SAFE e restaurar
   - [ ] Gaming Mode ativar e desativar, verificar restore
   - [ ] Cache cleanup com arquivos locked
   - [ ] WSL2 compaction com distro ativa (deve alertar)
   - [ ] Kill process de app nao-sistema

---

## 9. Build e Distribuicao

### 9.1 Build Pipeline

```
Source Code
    |
    +---> cargo build --release (Rust backend)
    |         |
    |         +---> src-tauri/target/release/windows-optimizer.exe
    |
    +---> npm run build (Vite, React frontend)
    |         |
    |         +---> src-tauri/target/release/dist/ (HTML/JS/CSS bundle)
    |
    +---> tauri build (combines both)
              |
              +---> Installer (NSIS): WindowsOptimizer_x.y.z_x64-setup.exe
              +---> Portable (single exe): WindowsOptimizer_x.y.z_x64.exe (v1.0)
```

**Comandos de build:**

```bash
# Development
npm run tauri dev          # Hot-reload frontend + Rust rebuild

# Production
npm run tauri build        # Full production build

# Portable (v1.0 - single exe)
npm run tauri build -- --bundles nsis   # Installer only (MVP)
```

### 9.2 Portable Mode (NFR-011, v1.0)

Para modo portable, o build gera um executavel standalone. A deteccao de modo portable e feita no Rust:

```rust
fn detect_portable_mode() -> bool {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = exe_dir {
        dir.join("portable.marker").exists()
    } else {
        false
    }
}
```

Se portable: data dir = `./data/` relativo ao exe. Se instalado: data dir = `%APPDATA%\WindowsOptimizer\`.

### 9.3 Instalador NSIS

Configuracao no `tauri.conf.json`:

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.ico"],
    "identifier": "com.italo.windows-optimizer",
    "nsis": {
      "displayLanguageSelector": false,
      "installMode": "currentUser",
      "languages": ["English"],
      "headerImage": null,
      "sidebarImage": null
    },
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    }
  }
}
```

**WebView2:** O installer usa `downloadBootstrapper` para instalar WebView2 automaticamente no Windows 10 se nao estiver presente.

**Tamanho estimado:** 5-8 MB (Tauri base ~2.5 MB + Rust binary + frontend bundle + assets).

### 9.4 Auto-Updater

[AUTO-DECISION] Incluir auto-updater? -> Nao no MVP (reason: projeto pessoal, rebuild manual e aceitavel. Tauri tem plugin de updater nativo para v1.0 se necessario. Reduce complexidade do MVP.)

---

## 10. Monitoramento de Temperaturas -- Detalhe Tecnico

### 10.1 Temperatura CPU

**Abordagem primaria: sysinfo crate**

O crate `sysinfo` expoe `Components` que lista sensores de temperatura do sistema. No Windows, ele usa internamente WMI.

```rust
use sysinfo::Components;

let components = Components::new_with_refreshed_list();
for component in &components {
    // component.label() -> "CPU Package", "CPU Core #0", etc.
    // component.temperature() -> f32 in Celsius
    // component.max() -> f32 max recorded
    // component.critical() -> Option<f32> critical threshold
}
```

**Fallback: WMI MSAcpi_ThermalZoneTemperature**

Se `sysinfo` nao retornar dados de CPU, usar WMI direto:

```rust
use wmi::{COMLibrary, WMIConnection};

#[derive(Deserialize)]
struct ThermalZone {
    #[serde(rename = "CurrentTemperature")]
    current_temperature: u32,  // In tenths of Kelvin
    #[serde(rename = "InstanceName")]
    instance_name: String,
}

// Query: SELECT * FROM MSAcpi_ThermalZoneTemperature
// Namespace: root\WMI (NOT root\cimv2)
// Conversion: Celsius = (value / 10) - 273.15
// REQUIRES: Admin privileges
```

**Fallback 2: LibreHardwareMonitor WMI bridge**

Se o usuario tiver LibreHardwareMonitor rodando (ele expoe dados via WMI em `root\LibreHardwareMonitor`), podemos ler de la:

```rust
// Namespace: root\LibreHardwareMonitor
// Query: SELECT * FROM Sensor WHERE SensorType='Temperature'
// Returns accurate per-core temperatures
// NOT a dependency — optional enhancement if LHM is running
```

**Cadeia de fallback:**
1. `sysinfo::Components` (nao requer admin)
2. WMI `MSAcpi_ThermalZoneTemperature` (requer admin, pode ser impreciso — retorna thermal zone, nao per-core)
3. WMI `root\LibreHardwareMonitor` (se LHM estiver rodando — mais preciso)
4. Retorna `None` com mensagem "Temperature sensor not available"

### 10.2 Temperatura GPU NVIDIA

**Via NVML (nvml-wrapper crate):**

```rust
use nvml_wrapper::Nvml;

let nvml = Nvml::init()?;
let device = nvml.device_by_index(0)?;

// Temperature
let temp = device.temperature(TemperatureSensor::Gpu)?;  // Celsius

// Additional metrics
let utilization = device.utilization_rates()?;
let memory_info = device.memory_info()?;
let clock_info = device.clock_info(Clock::Graphics)?;
let fan_speed = device.fan_speed(0)?;  // percentage
```

**Requer:** NVIDIA driver instalado. nvml.dll presente no sistema.
**Permissao:** User-level. Nao requer admin.
**Precisao:** Excelente. Dados diretos do hardware.

### 10.3 Temperatura GPU AMD

**MVP: WMI fallback**

Nao existe crate Rust madura para ADL SDK da AMD. No MVP, usar WMI basico:

```rust
// Query: SELECT * FROM Win32_VideoController
// Retorna: Name, DriverVersion, AdapterRAM
// NAO retorna temperatura (WMI padrao nao expoe temp de GPU AMD)
```

**v1.0: FFI bindings para ADL SDK**

O AMD Display Library (ADL) SDK e uma biblioteca C que expoe temperatura, clock, utilization de GPUs AMD.

```rust
// Via FFI bindings (atiadlxx.dll / atiadlxy.dll)
// Functions:
//   ADL2_Main_Control_Create
//   ADL2_OverdriveN_Temperature_Get
//   ADL2_Overdrive8_Current_Setting_Get
//   ADL2_Adapter_NumberOfAdapters_Get
```

**Alternativa v1.0: WMI via LibreHardwareMonitor**

Se LHM estiver rodando, ele expoe temperaturas AMD via WMI (mesmo namespace `root\LibreHardwareMonitor`).

[AUTO-DECISION] AMD GPU monitoring no MVP? -> Apenas info basica via WMI (nome, driver, VRAM). Temperaturas AMD ficam para v1.0 via FFI ou LHM bridge. (reason: sem crate Rust madura para ADL, FFI bindings sao complexos, e a maquina principal do Italo tem NVIDIA.)

### 10.4 Temperatura Disco NVMe

**Via WMI S.M.A.R.T.:**

```rust
// Namespace: root\WMI
// Query: SELECT * FROM MSStorageDriver_ATAPISmartData
// Attribute ID 194 (0xC2) = Temperature
// OR
// Namespace: root\Microsoft\Windows\Storage
// Query: SELECT * FROM MSFT_PhysicalDisk
// + MSFT_StorageReliabilityCounter (Temperature field)
```

**Via sysinfo crate:**

O `sysinfo` pode expor temperaturas de disco em Components, dependendo do hardware/driver.

**Permissao:** Pode requerer Admin para WMI namespace `root\WMI`.

### 10.5 Polling Intervals Recomendados

| Sensor | Intervalo | Justificativa |
|--------|-----------|---------------|
| CPU usage % | 2s | Boa resolucao sem overhead |
| CPU frequency | 2s | Muda com boost clock |
| RAM usage | 2s | Muda relativamente devagar |
| GPU usage % + VRAM | 2s | NVML e leve |
| GPU temperatura | 2s | Mudanca rapida sob carga |
| CPU temperatura | 2s | Mudanca rapida sob carga |
| Disk I/O | 3s | PDH counters, overhead menor |
| Network | 3s | PDH counters |
| Disk temperatura | 10s | Muda muito devagar |
| Disk space | 60s | Quase estatico |

**Thread model para monitoring:**

```rust
// Uma unica tokio task com loop:
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(2));
    let mut disk_counter = 0u32;

    loop {
        interval.tick().await;

        // Every tick (2s): CPU, RAM, GPU, temps
        sys.refresh_all();
        let cpu = collect_cpu_metrics(&sys);
        let ram = collect_ram_metrics(&sys);
        let gpu = nvml.as_ref().map(|n| collect_gpu_metrics(n));
        let temps = collect_temperatures(&sys, &nvml, &wmi_conn);

        // Every 5th tick (10s): disk temps
        disk_counter += 1;
        let disk_temps = if disk_counter % 5 == 0 {
            collect_disk_temperatures(&wmi_conn)
        } else {
            last_disk_temps.clone()
        };

        let metrics = SystemMetrics { cpu, ram, gpu, temps, disk_temps, .. };

        // Push to ring buffer
        buffer.lock().unwrap().push(metrics.clone());

        // Emit to frontend
        app.emit("system-metrics", &metrics).ok();

        // Check temperature alerts
        check_alerts(&app, &metrics, &thresholds);
    }
});
```

### 10.6 Formato dos Dados para Graficos Temporais

```typescript
// Frontend: array of timestamped values for Recharts
interface TimeSeriesPoint {
  timestamp: number;   // Unix epoch ms
  value: number;       // e.g., temperature in Celsius
}

// MetricsStore maintains rolling window:
// - 120 points for 2s interval = 4 minutes of live data
// - For 24h history: stored in MonitorBuffer (Rust), queried on demand

// Recharts data format:
const chartData = history.map(m => ({
  time: m.timestamp,
  cpuTemp: m.temperatures.cpuTempC,
  gpuTemp: m.temperatures.gpuTempC,
  cpuUsage: m.cpu.totalUsagePercent,
}));

// <LineChart data={chartData}>
//   <Line dataKey="cpuTemp" stroke="var(--accent-red)" />
//   <Line dataKey="gpuTemp" stroke="var(--accent-purple)" />
// </LineChart>
```

---

## 11. Architecture Decision Records

### ADR-001: Por que Tauri 2.x + Rust

**Status:** Accepted
**Data:** 2026-03-29
**Contexto:** Precisa-se definir a stack para um app desktop de otimizacao Windows. Candidatos: Electron+Node, Tauri+Rust, C#+WPF, Python+PyQt.

**Decisao:** Tauri 2.x (frontend web) + Rust (backend).

**Razoes:**
1. **Footprint minimo e obrigacao moral.** Um app de otimizacao que consome 200-300MB de RAM (Electron) e uma contradicao. Tauri idle: 30-40MB. Instalador: ~3-5MB vs ~85MB do Electron.
2. **Acesso nativo a APIs Windows.** O `windows` crate da Microsoft fornece bindings seguros (type-safe) para toda a Win32 API. O `wmi` crate permite queries tipadas. O `nvml-wrapper` da acesso direto a GPU NVIDIA. Nao ha necessidade de FFI manual para a maioria das operacoes.
3. **Seguranca capability-based.** Tauri 2 tem sistema de permissoes granular onde o frontend so acessa o que foi explicitamente permitido. Ideal para um app que manipula servicos do sistema e registry.
4. **Projeto de aprendizado.** O owner quer dominar Rust. A curva de aprendizado e aceita como investimento.
5. **Performance de compilacao Rust.** Operacoes de baixo nivel (scan de filesystem, hash de duplicados, PDH counters) se beneficiam enormemente da performance nativa.

**Alternativa rejeitada:** C#+WPF era a segunda opcao (score 7.5/10) mas a UI e menos flexivel que web technologies e nao se alinha com a stack React/TS ja dominada.

**Trade-offs:**
- (+) Menor footprint, melhor performance, seguranca granular
- (-) Curva de aprendizado Rust, ecossistema menor que .NET/Node, compilacao mais lenta
- (-) Depende de WebView2 (pre-instalado Win11, bootstrapper para Win10)

**Consequencias:** Time de desenvolvimento maior por ser Rust, mas produto final significativamente superior em footprint e performance. Aceito para projeto pessoal com objetivo de aprendizado.

---

### ADR-002: Estrategia de Elevacao de Privilegios

**Status:** Accepted
**Data:** 2026-03-29
**Contexto:** O app precisa de admin para ~60% das operacoes (services, registry HKLM, TRIM, flush, Windows Temp). Opcoes: (A) sempre rodar como admin, (B) elevacao sob demanda com re-lancamento, (C) helper process elevado separado.

**Decisao:** Opcao B — Elevacao sob demanda com re-lancamento do app.

**Razoes:**
1. **Opcao A (sempre admin) rejeitada:** UAC prompt toda vez que abre o app e irritante. Principio de menor privilegio violado. Monitoramento e limpeza de cache user nao precisam de admin.
2. **Opcao C (helper separado) rejeitada:** Adiciona complexidade de IPC inter-processo (named pipes ou TCP local), gestao de lifecycle de dois processos, e debugging mais dificil. Beneficio de UX (nao re-lancar) nao justifica a complexidade para projeto pessoal.
3. **Opcao B (re-lancamento) aceita:** Simples de implementar (`ShellExecuteW` com `runas`). Estado da sessao e salvo antes e restaurado apos. O usuario ve UAC prompt uma vez e o app continua de onde parou.

**Trade-offs:**
- (+) Simplicidade de implementacao, processo unico
- (-) Perda de estado momentanea durante re-lancamento (mitigada com session persistence)
- (-) Dois UAC prompts se o usuario fizer operacao admin, fechar, e reabrir

**Implementacao:**
- `is_elevated()`: verifica `TOKEN_ELEVATION` via `OpenProcessToken`
- `request_elevation()`: grava `session_state.json`, lanca novo processo via `ShellExecuteW("runas")` com flag `--restore-state`
- Novo processo: le `session_state.json`, restaura pagina e selecoes, deleta o arquivo

---

### ADR-003: Abordagem para Leitura de Temperaturas

**Status:** Accepted
**Data:** 2026-03-29
**Contexto:** Temperaturas de hardware sao criticas para o dashboard. Existem multiplas fontes com diferentes niveis de acuracidade e requisitos de permissao.

**Decisao:** Chain de fallback multi-fonte com graceful degradation.

**Cadeia de prioridade:**

| Sensor | Fonte 1 (preferida) | Fonte 2 | Fonte 3 | Permissao |
|--------|---------------------|---------|---------|-----------|
| CPU | `sysinfo::Components` | WMI `MSAcpi_ThermalZoneTemperature` | WMI `root\LibreHardwareMonitor` | User (1) / Admin (2) / User (3) |
| GPU NVIDIA | NVML `nvmlDeviceGetTemperature` | — | — | User |
| GPU AMD | WMI `root\LibreHardwareMonitor` (se LHM rodando) | WMI basico (sem temp) | — | User |
| Disco NVMe | WMI `MSFT_StorageReliabilityCounter` | `sysinfo::Components` | — | Admin |
| Motherboard | WMI thermal zones | `sysinfo::Components` | — | Admin |

**Razoes:**
1. `sysinfo` crate e a fonte mais simples e nao requer admin. Funciona em muitos hardwares.
2. WMI ThermalZone requer admin e retorna dados de zona termica (nao per-core), mas e universal.
3. LibreHardwareMonitor como fonte opcional e uma oportunidade de alta acuracidade sem dependencia — se o usuario ja roda LHM, aproveitamos os dados via WMI bridge.
4. Nao criar dependencia em LHM — o app funciona sem ele.

**Trade-offs:**
- (+) Funciona na maioria dos hardwares, com ou sem admin
- (-) Acuracidade varia (thermal zone != per-core CPU temp)
- (-) AMD GPU sem temperatura no MVP

**Consequencia:** O dashboard mostra "N/A" para sensores indisponiveis ao inves de crashar. Mensagem informativa: "Run as administrator for CPU temperature" ou "Install LibreHardwareMonitor for detailed temperatures".

---

### ADR-004: State Management no Frontend

**Status:** Accepted
**Data:** 2026-03-29
**Contexto:** O app precisa gerenciar estado real-time (metricas, scan results, gaming mode) no frontend React. Opcoes: (A) React Context, (B) Zustand, (C) Redux, (D) Jotai.

**Decisao:** Zustand.

**Razoes:**
1. **Lightweight:** ~1KB. Para um app que preza footprint, cada KB conta.
2. **Zero boilerplate:** Sem providers, reducers, actions. Stores sao funcoes puras.
3. **Selectors granulares:** `useMetricsStore(s => s.current?.cpu)` — re-render apenas quando CPU muda, nao quando RAM muda. Critico para graficos real-time.
4. **Middleware suportado:** `persist` para settings (salvar em localStorage/file), `devtools` para debug.
5. **TypeScript excelente:** Inferencia de tipos funciona sem annotations extras.

**Alternativas rejeitadas:**
- React Context: Re-render de toda a arvore quando metricas atualizam a cada 2s. Inaceitavel para performance.
- Redux: Overkill, boilerplate excessivo para app local sem servidor.
- Jotai: Atom-based e bom, mas Zustand e mais familiar (tech preset AIOX) e igualmente capaz.

**Trade-offs:**
- (+) Minimalista, performatico, TypeScript-friendly
- (-) Menos estrutura que Redux (aceitavel para app de escopo limitado)

---

### ADR-005: Modo Portable vs Instalador

**Status:** Accepted
**Data:** 2026-03-29
**Contexto:** O PRD pede tanto instalador (MVP) quanto modo portable (v1.0, NFR-011). Precisa definir como coexistem.

**Decisao:** MVP entrega apenas instalador NSIS. v1.0 adiciona modo portable com deteccao automatica via marker file.

**Mecanismo:**
1. **Instalador (MVP):** NSIS gera `WindowsOptimizer_setup.exe`. Instala em `%LOCALAPPDATA%\Programs\WindowsOptimizer\`. Data em `%APPDATA%\WindowsOptimizer\`. Cria shortcut no Start Menu.
2. **Portable (v1.0):** Mesmo binario, distribuido como ZIP. Contem `portable.marker` na raiz. Ao detectar esse arquivo, o app usa `./data/` como data dir. Nao escreve no Registry, nao cria entries em Programs & Features.
3. **Coexistencia:** Detectar modo no startup. Um path de dados ou outro. Nao conflitam.

**Trade-offs:**
- (+) Mesmo binario para ambos os modos, logica simples
- (-) Portable mode nao tem auto-update (aceitavel para uso pessoal)
- (-) Portable em pen drive: precisa copiar o ZIP inteiro (~5-8MB), nao single exe

**Nota:** Single .exe portable requereria embedding do WebView2 runtime, o que inflaria o tamanho para ~150MB+. Nao compensa. O portable e um ZIP com exe + data folder + portable.marker.

---

## Apendice: Dependencias entre Modulos (Mapa Visual)

```
                    +-------------------+
                    | platform/         |
                    | (Windows APIs)    |
                    +-------------------+
                      ^   ^   ^   ^   ^
                      |   |   |   |   |
      +---------------+   |   |   |   +----------------+
      |                   |   |   |                    |
+----------+  +----------+  +----------+  +----------+  +----------+
| cache_   |  | gpu_     |  | service_ |  | system_  |  | disk_    |
| cleaner  |  | cleaner  |  | manager  |  | monitor  |  | optimizer|
+----------+  +----------+  +----------+  +----------+  +----------+
      |              |             |              |             |
      |              |             |              |             |
      v              v             v              |             |
+----------+  +----------+  +----------+         |             |
| dev_     |  | gaming_  |  | startup_ |         |             |
| cleaner  |  | mode     |  | manager  |         |             |
+----------+  +----------+  +----------+         |             |
                   |                              |             |
                   +--- uses service_manager      |             |
                   +--- uses gpu_cleaner          |             |
                   +--- uses ram_optimizer --------+             |
                                                                |
              +----------+                                      |
              | preset_  |---------- uses cache_cleaner         |
              | manager  |---------- uses gpu_cleaner           |
              +----------+---------- uses service_manager       |
                         |---------- uses ram_optimizer         |
                         +---------- uses disk_optimizer -------+
```

**Regra de dependencia:** `commands/` -> `modules/` -> `platform/`. Nunca o inverso. `config/` e `state/` sao acessados por `modules/` e `commands/`.

---

**Documento gerado por Aria (Architect Agent) em 2026-03-29.**
**Baseado no PRD v1.1.0, estudo de viabilidade, e pesquisa de foruns de usuarios.**
**Status: READY FOR REVIEW.**

-- Aria, arquitetando o futuro
