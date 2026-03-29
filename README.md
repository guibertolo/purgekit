# PurgeKit

**Clean power. Zero bloat.**

App desktop de otimizacao de sistema Windows construido com Tauri 2 + Rust.

## Stack

- **Backend:** Tauri 2.x + Rust
- **Frontend:** React + TypeScript + Zustand + Recharts
- **Design:** Geist Sans/Mono + Lucide Icons + Dark Theme (Surgical Precision)
- **Target:** Windows 10/11

## Modulos

| # | Modulo | Prioridade |
|---|--------|-----------|
| 1 | Limpeza de Cache do Sistema | MVP |
| 2 | Limpeza de Cache GPU | MVP |
| 3 | Otimizacao de Servicos | v1.0 |
| 4 | Gerenciador de Inicializacao | v1.0 |
| 5 | Otimizacao de RAM | v1.0 |
| 6 | Otimizacao de Disco | v1.0 |
| 7 | Monitoramento + Temperaturas | MVP |
| 8 | Presets e Automacao | v1.0 |
| 9 | Developer Mode | MVP |
| 10 | Gaming Mode | MVP |

## Docs

- `docs/prd-windows-optimizer.md` — PRD v1.1.0 (70 FRs)
- `docs/architecture-windows-optimizer.md` — Arquitetura + 5 ADRs
- `docs/research/windows-optimizer-app-study.md` — Estudo de viabilidade
- `docs/research/user-needs-forum-research.md` — Pesquisa de foruns
- `docs/research/naming-brainstorm.md` — Brainstorm de naming
- `docs/research/visual-identity-concept.md` — Identidade visual
- `docs/stories/active/` — 28 stories do MVP (validadas pelo PO)
- `docs/stories/validation-report-mvp.md` — Relatorio de validacao

## Setup (TODO)

```bash
# Prerequisites: Rust, Node.js 20+, Tauri CLI
cargo install create-tauri-app
cd apps/purgekit
npm install
npm run tauri dev
```
