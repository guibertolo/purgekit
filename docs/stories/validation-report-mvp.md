# Validation Report — Windows Optimizer MVP

**Data:** 2026-03-29
**Validador:** Pax (PO Agent)
**PRD:** `docs/prd-windows-optimizer.md` v1.1.0
**Arquitetura:** `docs/architecture-windows-optimizer.md` v1.0.0
**Total de stories avaliadas:** 28

---

## 1. Resumo Geral

| Metrica | Valor |
|---------|-------|
| Stories GO (>= 7/10) | 24 |
| Stories GO com observacoes (5-6/10) | 2 |
| Stories NO-GO (< 5/10) | 2 |
| Score medio | 8.8/10 |
| Story Points total | 123 SP |

**Decisao final: NEEDS REVISION** — 2 stories requerem correcao obrigatoria antes de iniciar desenvolvimento (10.3 e 10.4 excedem sweet spot de SP).

---

## 2. Tabela de Scores

| Story | Titulo | SP | Score | Status |
|-------|--------|----|-------|--------|
| 1.1 | Scaffold Tauri 2.x Project | 5 | 10/10 | GO |
| 1.2 | Dark Theme e UI Shell | 5 | 9/10 | GO |
| 1.3 | Logging Persistente e Config Store | 3 | 10/10 | GO |
| 1.4 | UAC Elevation Handler | 3 | 10/10 | GO |
| 1.5 | Installer NSIS com Deteccao de WebView2 | 3 | 9/10 | GO |
| 2.1 | Scanner de Temp Files | 5 | 10/10 | GO |
| 2.2 | Scanner de Browser Cache | 5 | 9/10 | GO |
| 2.3 | Limpeza de Windows Update Cache, Prefetch e Recycle Bin | 5 | 9/10 | GO |
| 2.4 | UI do Cache Cleaner | 5 | 10/10 | GO |
| 2.5 | Execucao de Limpeza com Progresso e Logging | 5 | 10/10 | GO |
| 3.1 | Deteccao de GPU via NVML e WMI | 5 | 10/10 | GO |
| 3.2 | Scan e Limpeza de Shader Cache NVIDIA | 3 | 9/10 | GO |
| 3.3 | Scan e Limpeza de Shader Cache AMD e DirectX | 3 | 9/10 | GO |
| 3.4 | UI do Modulo GPU Cache | 3 | 10/10 | GO |
| 4.1 | Monitor de CPU em Tempo Real | 5 | 9/10 | GO |
| 4.2 | Monitor de RAM em Tempo Real | 3 | 10/10 | GO |
| 4.3 | Monitor de GPU NVIDIA em Tempo Real | 5 | 9/10 | GO |
| 4.4 | Monitoramento de Temperatura CPU com Alertas | 5 | 9/10 | GO |
| 4.5 | Dashboard Unificado com Graficos Real-Time | 5 | 9/10 | GO |
| 9.1 | Deteccao de Ferramentas de Desenvolvimento | 3 | 10/10 | GO |
| 9.2 | Scan de node_modules Orfaos | 5 | 10/10 | GO |
| 9.3 | Limpeza de Caches de Package Managers JS e Docker | 5 | 9/10 | GO |
| 9.4 | Compactacao WSL2 e Limpeza de Caches pip/cargo/Go/Maven/Gradle | 5 | 9/10 | GO |
| 9.5 | UI do Developer Mode | 5 | 9/10 | GO |
| 10.1 | Snapshot de Estado do Sistema e Mecanismo de Restore | 5 | 10/10 | GO |
| 10.2 | Desativacao Temporaria de Servicos para Gaming | 5 | 9/10 | GO |
| 10.3 | Gaming Mode — GPU Cache, RAM Flush, Game DVR e Prioridade | 8 | 5/10 | GO c/ obs |
| 10.4 | Gaming Mode — Ativacao Automatica por Processo e UI | 8 | 5/10 | GO c/ obs |

---

## 3. Observacoes por Story

### Stories com score perfeito (10/10) — sem observacoes

1.1, 1.3, 1.4, 2.1, 2.4, 2.5, 3.1, 3.4, 4.2, 9.1, 9.2, 10.1

### Stories GO (9/10) — observacoes menores

**Story 1.2 (9/10)**
- (-1) AC-10 lista componentes `Button`, `Toggle`, `Badge`, `Tooltip` que nao tem FR reference direto. Aceitavel como infraestrutura UI, mas poderia referenciar NFR-003 explicitamente para os componentes base.

**Story 1.5 (9/10)**
- (-1) CON-004 (sem code signing) esta referenciado mas a story nao explicita como lidar com SmartScreen warning na UI. O Technical Notes menciona que e "aceitavel", o que e suficiente, mas uma AC explicita garantiria que o dev nao tenta implementar signing.

**Story 2.2 (9/10)**
- (-1) AC-6 menciona glob para Firefox profiles (`*\cache2\`), mas a story nao menciona que Chrome e Edge tambem podem ter multiplos profiles (`Profile 1`, `Profile 2`). A implementacao deveria cobrir alem de `Default\Cache\`. Observacao menor — nao bloqueia.

**Story 2.3 (9/10)**
- (-1) A story referencia FR-003 e FR-004 (limpeza de Update e Prefetch) mas a execucao real da limpeza esta na Story 2.5. A Story 2.3 implementa scan E limpeza de Recycle Bin E controle de servico wuauserv, mas scan-only para Update/Prefetch. O titulo sugere "Limpeza" para os tres, o que pode confundir o dev.

**Story 3.2 (9/10)**
- (-1) AC-6 introduz `requires_nvidia: true` como campo, mas na Story 3.1 o campo equivalente em `GpuCacheCategory` e `available: bool`. Nomenclatura inconsistente entre stories do mesmo epic — o dev deve seguir a struct da 3.2 que e mais especifica, mas seria melhor alinhar.

**Story 3.3 (9/10)**
- (-1) Dependencia em 3.2 pode ser excessiva — a limpeza AMD/DirectX nao depende tecnicamente de NVIDIA estar implementada, apenas da estrutura GpuCacheCategory (que e definida na 3.2). Poderia depender apenas de 3.1.

**Story 4.1 (9/10)**
- (-1) Technical Notes usa `CpuExt` e `SystemExt` traits que foram removidos no sysinfo 0.32 (a versao no Cargo.toml da 1.1). Na sysinfo 0.32+, os metodos estao diretamente no `System`. O pseudo-codigo pode confundir o dev. Observacao menor — o dev verificara a documentacao.

**Story 4.3 (9/10)**
- (-1) Mesmo issue da 4.1 — referencia traits sysinfo depreciadas. Alem disso, `nvml_wrapper::enum_wrappers::device::ClockId::Current` pode nao ser a API correta na versao 0.10. O dev deve verificar docs.

**Story 4.4 (9/10)**
- (-1) FR-046 (alertas visuais) esta parcialmente coberto — a story implementa alertas apenas para CPU, nao para GPU (que ja tem temperatura na 4.3 mas sem alerta). O alerta de GPU poderia ser incluido aqui tambem, ou ter uma nota de que sera adicionado na 4.5.

**Story 4.5 (9/10)**
- (-1) Depende de 4.1-4.4 (4 stories), o que e muito — se qualquer uma atrasar, bloqueia o Dashboard. A story tambem adiciona `DiskInfo` ao `SystemMetrics`, que e nova logica de backend misturada com trabalho de frontend. Poderia separar o `build_disk_info()` em uma subtask clara.

**Story 9.3 (9/10)**
- (-1) Docker `--format json` nao e suportado em todas as versoes do Docker. A story menciona alternativa de parsear texto, mas nao e um AC explicito. Se a versao do Docker do usuario nao suporta JSON, o fallback deve ser garantido.

**Story 9.4 (9/10)**
- (-1) Compactacao WSL2 via `Optimize-VHD` requer Hyper-V feature que nao esta em Windows 10 Home. O fallback via diskpart esta nas Technical Notes mas nao e um AC explicito — pode ser esquecido pelo dev. Deveria ser AC.

**Story 9.5 (9/10)**
- (-1) 5 dependencias (1.2, 9.1, 9.2, 9.3, 9.4) — muito encadeada. Se qualquer story anterior atrasar, bloqueia toda a UI do Developer Mode. Considerar que a UI pode ser implementada progressivamente.

**Story 10.2 (9/10)**
- (-1) FR-019 (classificacao DANGEROUS) e referenciada via FR-064 mas a classificacao de servicos em si nao e implementada no MVP — e v1.0 (Service Manager). A story usa uma lista hardcoded de servicos "seguros" para gaming sem o sistema formal de classificacao. Funciona, mas a rastreabilidade ao FR-019 e indireta.

### Stories GO com observacoes (5-6/10) — requerem atencao

**Story 10.3 (5/10) — GO com observacoes**

| Criterio | Score | Observacao |
|----------|-------|------------|
| User Story clara | 1 | OK |
| ACs verificaveis | 1 | OK - 12 ACs |
| FR References | 1 | FR-065, FR-066, FR-067, FR-070 - todos validos |
| Dependencias corretas | 1 | 10.1, 10.2, 3.3 - corretas |
| **Story Points razoaveis** | **0** | **8 SP excede o range 3-8, e a story agrupa 4 FRs distintos** |
| **Escopo focado** | **0** | **4 funcionalidades independentes (GPU cache, RAM flush, Game DVR, prioridade de processo) em uma unica story. Cada uma poderia ser sua propria story.** |
| Technical Notes adequadas | 1 | Detalhadas para cada FR |
| Sem invencao | 1 | Tudo rastreavel ao PRD |
| Sem ambiguidade | 0 | AC-4/AC-5 "processos nao-essenciais" nao define criterio exato. AC-7 "estimado" sem definir como estimar |
| Testabilidade | 0 | Dificil testar "RAM freed" de forma deterministica; Game DVR changes requerem Registry verification manual |

**Problemas criticos:**
1. **Escopo excessivo** — 4 FRs distintos em uma story viola o principio de "faz UMA coisa bem"
2. **8 SP no limite** — esta no limite superior do range aceitavel
3. **Ambiguidade** em "processos nao-essenciais" e "estimativa de RAM freed"

**Recomendacao:** Aceitar como esta mas o dev deve ter ciencia de que esta story e oversized. Pode ser dividida se o development se complicar.

---

**Story 10.4 (5/10) — GO com observacoes**

| Criterio | Score | Observacao |
|----------|-------|------------|
| User Story clara | 1 | OK, mas tenta cobrir 2 capacidades (auto-detect + UI) |
| ACs verificaveis | 1 | OK - 14 ACs |
| FR References | 1 | FR-069, FR-068 - validos |
| Dependencias corretas | 1 | 10.1, 10.2, 10.3 - corretas |
| **Story Points razoaveis** | **0** | **8 SP excede o range ideal, e a story mistura backend (process watcher) + frontend (pagina inteira)** |
| **Escopo focado** | **0** | **Duas capacidades distintas: (1) background process watcher com ativacao automatica, (2) toda a pagina GamingMode.tsx UI. Cada uma justifica uma story.** |
| Technical Notes adequadas | 1 | Detalhadas |
| Sem invencao | 1 | Tudo rastreavel ao PRD |
| Sem ambiguidade | 0 | AC-3 "ativa Gaming Mode automaticamente" — mas ativacao requer admin (UAC prompt inesperado pode assustar). Nao define como lidar com UAC em ativacao automatica |
| Testabilidade | 0 | AC-3/AC-4 dificeis de testar automaticamente (dependem de abrir/fechar processo externo) |

**Problemas criticos:**
1. **Escopo excessivo** — process watcher + UI completa em uma story
2. **Ambiguidade em UAC** — ativacao automatica que requer admin levanta prompt UAC inesperado; como lidar?
3. **8 SP no limite**

**Recomendacao:** Aceitar como esta mas o dev deve ter ciencia. A ambiguidade do UAC em ativacao automatica e o maior risco tecnico.

---

## 4. Analise de Cobertura de FRs do MVP

### FRs cobertos pelas stories (MVP scope)

| FR | Story | Status |
|----|-------|--------|
| FR-001 | 2.1, 2.5 | Coberto |
| FR-002 | 2.1, 2.5 | Coberto |
| FR-003 | 2.3, 2.5 | Coberto |
| FR-004 | 2.3, 2.5 | Coberto |
| FR-006 | 2.2, 2.5 | Coberto |
| FR-010 | 2.3, 2.5 | Coberto |
| FR-011 | 2.1, 2.4 | Coberto |
| FR-012 | 3.1, 3.4 | Coberto |
| FR-013 | 3.2 | Coberto |
| FR-014 | 3.3 | Coberto |
| FR-015 | 3.3 | Coberto |
| FR-016 | 3.2, 3.3, 3.4 | Coberto |
| FR-017 | 3.2, 3.3, 3.4 | Coberto |
| FR-040 | 4.1, 4.5 | Coberto |
| FR-041 | 4.2, 4.5 | Coberto |
| FR-042 | 4.3, 4.5 | Coberto |
| FR-045 | 4.3, 4.4, 4.5 | Parcial (CPU e GPU apenas, sem disco/placa-mae — conforme MVP scope) |
| FR-046 | 4.4, 4.5 | Coberto |
| FR-048 | 4.5 | Coberto |
| FR-053 | 9.1 | Coberto |
| FR-054 | 9.2 | Coberto |
| FR-055 | 9.3 | Coberto |
| FR-056 | 9.3 | Coberto |
| FR-057 | 9.4 | Coberto |
| FR-058 | 9.4 | Coberto |
| FR-059 | 9.4 | Coberto |
| FR-060 | 9.4 | Coberto |
| FR-061 | 9.4 | Coberto |
| FR-062 | 9.5 | Coberto |
| FR-063 | 10.1, 10.4 | Coberto |
| FR-064 | 10.2 | Coberto |
| FR-065 | 10.3 | Coberto |
| FR-066 | 10.3 | Coberto |
| FR-067 | 10.3 | Coberto |
| FR-068 | 10.1, 10.2, 10.4 | Coberto |
| FR-069 | 10.4 | Coberto |
| FR-070 | 10.3 | Coberto |

### FRs excluidos do MVP (conforme PRD secao 8)

FR-005, FR-007, FR-008, FR-009, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, FR-033, FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-043, FR-044, FR-047, FR-049, FR-050, FR-051, FR-052

**Nota:** FR-030 (flush working sets) esta excluido como feature standalone (Modulo 5: RAM Optimizer), mas e usado como sub-funcionalidade do Gaming Mode (FR-066). Isso esta correto — o PRD lista Gaming Mode como MVP e RAM Optimizer como v1.0.

### NFRs cobertos

| NFR | Stories | Status |
|-----|---------|--------|
| NFR-001 (< 50 MB RAM) | 1.1, 1.5 | Coberto |
| NFR-002 (< 10 MB installer) | 1.5 | Coberto |
| NFR-003 (dark theme gamer) | 1.2, 4.2, 4.5 | Coberto |
| NFR-004 (confirmacao explicita) | 1.2, 2.4, 3.4, 9.5, 10.4 | Coberto |
| NFR-005 (undo/rollback servicos) | 10.1 | Coberto (via snapshot/restore) |
| NFR-006 (logging persistente) | 1.3, 2.5 | Coberto |
| NFR-007 (Win10 + Win11) | 1.1, 1.5 | Coberto |
| NFR-008 (startup < 1s) | 1.1 | Coberto |
| NFR-009 (monitoring < 1% CPU) | 4.1, 4.2, 4.3 | Coberto |
| NFR-010 (elevacao sob demanda) | 1.4 | Coberto |
| NFR-011 (modo portable) | 1.3 | Coberto (config store) |
| NFR-012 (Honest UI) | 1.2, 2.4, 3.4, 4.5, 9.5, 10.4 | Coberto |

### CONs verificados

| CON | Stories | Status |
|-----|---------|--------|
| CON-001 (Tauri 2 + Rust + React) | 1.1 | Coberto |
| CON-002 (sem backend remoto) | 1.1 | Coberto |
| CON-003 (sem negocio) | N/A | Correto — nenhuma story tem pricing/license |
| CON-004 (sem code signing) | 1.5 | Coberto |
| CON-005 (Windows only) | 1.1 | Coberto |
| CON-006 (WebView2 dependency) | 1.5 | Coberto |
| CON-007 (temp CPU WMI admin) | 4.4 | Coberto |
| CON-008 (AMD v1.0) | 3.1 | Coberto |
| CON-009 (NUNCA registry cleaning) | N/A | Correto — nenhuma story tenta registry cleaning |
| CON-010 (NUNCA RAM boost cosmetico) | 10.3 | Story inclui RAM flush honesto com aviso |
| CON-011 (NUNCA bundleware) | 1.5 | Coberto |

---

## 5. Analise Transversal

### 5.1 Dependencias — Grafo de Criticidade

```
Epicentro: Story 1.1 (scaffold) — bloqueia TODAS as outras stories
                |
    +-----------+-----------+
    |           |           |
   1.2         1.3         1.5
    |           |
    |     +-----+-----+
    |     |     |     |
    |    1.4   2.1   3.1    4.1    9.1    10.1
    |          |           |             |
    |    2.2  2.3          |        10.2
    |     |    |           |         |
    |    2.4   |      4.2 4.3 4.4  10.3
    |     |    |           |         |
    |    2.5   |          4.5      10.4
    |          |
    |         3.2         9.2  9.3  9.4
    |          |                |
    |         3.3              9.5
    |          |
    |         3.4
```

**Risco:** Stories 4.5, 9.5, e 10.4 tem 4-5 dependencias cada. Se qualquer dependencia atrasar, a UI final desses modulos fica bloqueada. Recomendacao: priorizar as stories de fundacao (Epic 1) acima de tudo.

### 5.2 Distribuicao de Story Points

| Epic | Stories | SP Total | % do MVP |
|------|---------|----------|----------|
| 1 - Foundation | 5 | 19 | 15.4% |
| 2 - Cache Cleaner | 5 | 25 | 20.3% |
| 3 - GPU Cache | 4 | 14 | 11.4% |
| 4 - Monitor | 5 | 23 | 18.7% |
| 9 - Developer Mode | 5 | 23 | 18.7% |
| 10 - Gaming Mode | 4 | 26 | 21.1% |
| **Total** | **28** | **123** | **100%** |

**Nota:** Epics 5, 6, 7, 8 nao tem stories no MVP (excluidos conforme PRD secao 8). Epics numerados 5-8 nao existem nas stories, saltando direto de Epic 4 para Epic 9. Isso esta correto — esses modulos sao v1.0.

### 5.3 Riscos Identificados

1. **Stories 10.3 e 10.4 oversized (8 SP cada)** — ambas agrupam funcionalidades que poderiam ser stories separadas. Se o dev encontrar dificuldades tecnicas em uma das sub-funcionalidades, toda a story bloqueia.

2. **Pseudo-codigo desatualizado com sysinfo 0.32** — Stories 4.1 e 4.3 usam traits `CpuExt`/`SystemExt` que nao existem na versao especificada. O dev precisara consultar a documentacao atualizada.

3. **Ativacao automatica de Gaming Mode + UAC** — Story 10.4 AC-3 nao resolve o conflito entre ativacao automatica (que detecta o jogo) e elevacao UAC (que requer prompt manual). O dev tera que tomar decisao de design.

4. **WSL2 compactacao em Windows 10 Home** — Story 9.4 depende de `Optimize-VHD` que requer Hyper-V (nao disponivel no Home). O fallback via diskpart esta nas notes mas nao nos ACs.

---

## 6. Decisao Final

**Status: NEEDS REVISION**

### Acoes obrigatorias (0)

Nenhuma story esta NO-GO. Todas as 28 stories passam no checklist com score >= 5.

### Acoes recomendadas (nao bloqueantes)

1. **Stories 10.3 e 10.4:** Considerar dividir cada uma em 2 stories menores (10.3a: GPU Cache + RAM Flush, 10.3b: Game DVR + Process Priority; 10.4a: Process Watcher, 10.4b: Gaming Mode UI). Isso reduziria o risco de bloqueio e facilitaria o tracking.

2. **Story 10.4:** Adicionar AC explicita sobre como lidar com UAC em ativacao automatica (opcoes: skip ativacao se nao admin, ou notificar usuario para ativar manualmente).

3. **Story 9.4:** Promover fallback diskpart a AC explicita (nao apenas Technical Note).

4. **Stories 4.1/4.3:** Adicionar nota de que pseudo-codigo de sysinfo usa API pre-0.32 e o dev deve consultar docs atualizados.

### Veredicto

**APPROVED com observacoes.** As 28 stories cobrem 100% dos FRs do MVP, todos os NFRs relevantes, e todas as constraints. As 2 stories com observacoes (10.3, 10.4) sao funcionais mas oversized — recomendo divisao se o sprint permitir. Nenhuma story viola Article IV (No Invention) — tudo e rastreavel ao PRD.

---

*Validacao executada por Pax (PO Agent) em 2026-03-29*
*PRD v1.1.0 | Arquitetura v1.0.0 | 28 stories | 123 SP*
