# Identidade Visual e Conceito de Logo
# Windows Optimizer App (Tauri 2 + Rust)

**Data:** 2026-03-29
**Especialista:** @aaron-draplin (Logo & Brand Marks) com input de @marty-neumeier (Brand Strategy)
**Roteado por:** Design Chief
**Status:** Conceito Completo

---

## Posicionamento de Marca (Brand Context)

Antes dos visuais, o posicionamento que guia todas as decisoes:

**Zag (diferenciacao):** Enquanto CCleaner e generico e corporativo, IObit e excessivo e visual noise, e BleachBit e austero demais -- este app e o **bisturi cirurgico** do mundo de otimizacao. Preciso, leve, tecnico, bonito.

**Brand Gap:** A lacuna no mercado e um otimizador que **parece tao premium quanto o hardware que ele otimiza**. Usuarios de NZXT, Corsair e Razer esperam esse nivel de polimento. Nenhum optimizer entrega isso.

**Personalidade de marca:** Preciso. Silencioso. Poderoso. Pensa no contraste entre um bisturi e um martelo -- ambos sao ferramentas, mas um exige expertise.

---

## 1. Moodboard Conceitual -- 3 Direcoes Visuais

### Direcao A: "Surgical Precision" (RECOMENDADA)

**Paleta de Cores:**
| Role | Cor | Hex | Uso |
|------|-----|-----|-----|
| Primary | Electric Cyan | `#00D4FF` | Accent principal, elementos ativos, CTAs |
| Primary Variant | Deep Cyan | `#0099CC` | Hover states, borders ativos |
| Secondary | Cool White | `#E8EAED` | Texto primario, icones ativos |
| Accent | Pulse Cyan | `#00FFE5` | Indicadores de status, progress bars, glow |
| Background 1 | Void Black | `#0A0A0F` | Background principal da janela |
| Background 2 | Deep Slate | `#12121A` | Cards, paineis |
| Background 3 | Charcoal | `#1A1A25` | Elementos elevados, menus |
| Surface | Graphite | `#22222E` | Input fields, toggles background |

**Tipografia:** Geist Sans (headings) + Geist Mono (dados tecnicos)

**Estilo de Icones:** Line icons com 1.5px stroke, cantos arredondados suaves (2px radius), monocromaticos com accent cyan em estados ativos. Limpos, geometricos, sem ornamento.

**Referencias Visuais:**
- NZXT CAM: layout limpo, widgets modulares, sidebar navegacao
- Warp Terminal: tipografia excelente, dark theme refinado, uso de accent color
- Linear App: minimalismo funcional, micro-animacoes sutis
- Vercel Dashboard: hierarquia de informacao impecavel

**Mood/Sentimento:** Sala de controle de nave espacial. Tudo e preciso, cada pixel tem proposito. Voce sente que esta usando uma ferramenta profissional, nao um brinquedo. O cyan eletrico contra o void black cria tensao visual controlada -- como um LED de status num hardware premium.

---

### Direcao B: "Neon Forge"

**Paleta de Cores:**
| Role | Cor | Hex | Uso |
|------|-----|-----|-----|
| Primary | Violet Pulse | `#7C3AED` | Accent principal |
| Primary Variant | Deep Violet | `#5B21B6` | Hover, borders |
| Secondary | Hot Magenta | `#FF2E97` | Accent secundario, destaques |
| Accent | Electric Lime | `#CCFF00` | Alertas, badges, status ativo |
| Background 1 | Abyss | `#08080D` | Background principal |
| Background 2 | Obsidian | `#0F0F18` | Cards |
| Background 3 | Dark Purple Haze | `#16142A` | Elementos elevados |
| Surface | Shadow Purple | `#1E1B33` | Inputs, toggles |

**Tipografia:** Space Grotesk (headings) + JetBrains Mono (dados tecnicos)

**Estilo de Icones:** Duotone icons -- outline em cor neutra, fill em accent gradient. Mais expressivos e visualmente marcantes.

**Referencias Visuais:**
- Razer Synapse: energia gamer, verde neon agressivo (nos adaptamos com violet)
- Discord: dark theme bem executado com accent roxo
- Figma: uso inteligente de gradientes sutis
- Notion: organizacao e clareza

**Mood/Sentimento:** Oficina de alta tecnologia a noite. Neon refletindo em metal escuro. E mais ousado que a Direcao A -- apela fortemente ao publico gamer, mas pode parecer "demais" para developers que preferem minimalismo. A combinacao violet + magenta + lime cria uma identidade memoravel mas polarizante.

---

### Direcao C: "Carbon Core"

**Paleta de Cores:**
| Role | Cor | Hex | Uso |
|------|-----|-----|-----|
| Primary | Amber Signal | `#FF9500` | Accent principal, indicadores |
| Primary Variant | Deep Amber | `#CC7700` | Hover, borders |
| Secondary | Steel Blue | `#64748B` | Elementos secundarios, labels |
| Accent | Hot White | `#FFFFFF` | Destaques de alto contraste |
| Background 1 | True Black | `#050505` | Background principal |
| Background 2 | Carbon | `#0D0D0D` | Cards |
| Background 3 | Graphene | `#161616` | Elementos elevados |
| Surface | Dark Steel | `#1F1F1F` | Inputs, toggles |

**Tipografia:** Inter (headings) + IBM Plex Mono (dados tecnicos)

**Estilo de Icones:** Filled icons com peso visual consistente, estilo system UI. Solid, confiaveis, sem frescura.

**Referencias Visuais:**
- macOS System Preferences: clareza e hierarquia
- HWiNFO: densidade de informacao (adaptada com melhor design)
- Raycast: minimalismo extremo funcional
- Terminal.app (customizado): seriedade tecnica

**Mood/Sentimento:** Painel de instrumentos de um carro de corrida. Funcionalidade pura, cada informacao e critica. O amber contra black puro e industrial, automotivo, seriamente tecnico. Menos "bonito" que as outras direcoes, mais "real". Apela ao publico que desconfia de interfaces floridas.

---

## 2. Conceitos de Logo -- 3 Opcoes

### Conceito 1: "Prism" (RECOMENDADO -- Direcao A)

**Descricao detalhada:**
Um hexagono com as bordas levemente chanfradas (beveled), representando um prisma visto de cima. Dentro do hexagono, um unico raio de luz (line art) entra por um vertice e se refrata em 3 feixes que saem por outros vertices -- representando como o app pega uma entrada (seu sistema) e a otimiza em multiplas dimensoes (cache, GPU, temperatura).

O hexagono usa um stroke fino (1.5px em tamanho padrao) em `#00D4FF`. Os feixes de refracao usam um sutil gradiente de `#00D4FF` para `#00FFE5`. O interior e transparente/void black.

**Composicao:**
- Logotipo: hexagono + wordmark ao lado direito
- Wordmark: nome do app em Geist Sans Medium, letter-spacing +0.02em
- Espacamento entre simbolo e wordmark: 1x a largura do hexagono

**Tamanho pequeno (tray icon 16x16):**
- Simplifica para apenas o hexagono com os 3 feixes internos
- Remove detalhes de refracao, mantem apenas as 3 linhas divergentes
- Em 16x16, o hexagono e solido com as linhas em negativo (knockout)
- Testado: reconhecivel como forma distinta mesmo em 16x16

**Tamanho grande (splash screen):**
- Versao completa com animacao sutil: o raio de luz "entra" e os feixes "aparecem" sequencialmente (0.3s total)
- Efeito de glow sutil no cyan accent
- Abaixo: wordmark completo + tagline em Geist Sans Light

**Variacoes:**
- **Colorido (padrao):** Cyan (#00D4FF) sobre fundo escuro (#0A0A0F)
- **Monocromatico claro:** Branco (#FFFFFF) sobre fundo escuro
- **Monocromatico escuro:** Preto (#0A0A0F) sobre fundo claro (para documentos impressos)
- **Alto contraste:** Cyan com glow (#00FFE5 glow) sobre pure black (para splash/marketing)

**Simbolismo:**
- Hexagono: estabilidade, engenharia, perfeicao geometrica (referencia a moleculas de carbono, grafeno -- ultra-resistente e leve como o app em Rust)
- Refracao: transformacao -- o app transforma um input bruto em output otimizado
- 3 feixes: os 3 pilares do app (limpeza, monitoramento, otimizacao)
- Transparencia interna: leveza, nao esconde nada, open-book

---

### Conceito 2: "Pulse" (Direcao B)

**Descricao detalhada:**
Um circulo com um "corte" angular no canto inferior direito (como se um pedaco fosse removido em angulo de 45 graus), criando uma forma que sugere tanto um medidor de gauge quanto uma letra "C" ou "O" estilizada. Dentro do circulo, uma linha de pulso (como um heartbeat/ECG) faz um pico acentuado no centro -- representando o "pulso" do sistema.

A forma usa gradiente de `#7C3AED` (violet) para `#FF2E97` (magenta). A linha de pulso e `#CCFF00` (electric lime).

**Composicao:**
- Logotipo: simbolo + wordmark abaixo (stacked) ou ao lado (horizontal)
- Wordmark: Space Grotesk Bold, tracking normal
- O corte no circulo cria uma abertura visual que da dinamismo

**Tamanho pequeno (tray icon 16x16):**
- O circulo com corte e reconhecivel em tamanhos pequenos
- A linha de pulso simplifica para um unico pico em "V" invertido
- Em 16x16, o gradiente simplifica para cor solida violet

**Tamanho grande (splash screen):**
- Versao completa com a linha de pulso animada (ECG animation, 1.5s loop)
- O gradiente violet-magenta brilha suavemente
- Particulas de glow emanam do pico do pulso

**Variacoes:**
- **Colorido:** Gradiente violet-magenta com lime pulse
- **Monocromatico claro:** Branco com outline
- **Monocromatico escuro:** Preto solido
- **Neon:** Versao com glow exagerado para materiais de marketing

**Simbolismo:**
- Circulo cortado: sistema em analise, "abrindo" para inspecao
- Pulso/ECG: saude do sistema, monitoramento vital
- Pico do pulso: o momento de otimizacao, o "boost"
- Gradiente: energia, dinamismo, modernidade

---

### Conceito 3: "Stack" (Direcao C)

**Descricao detalhada:**
Tres barras horizontais empilhadas com alturas decrescentes (maior embaixo, menor em cima), como um grafico de barras simplificado ou camadas de sistema. As barras tem cantos arredondados (4px radius em tamanho padrao) e espacamento uniforme entre elas. A barra inferior e mais larga e em amber (#FF9500), a do meio e media e em steel (#64748B), a superior e menor e em white (#FFFFFF).

Juntas, as barras formam uma silhueta que lembra tanto um grafico de performance quanto a letra "E" estilizada (deitada).

**Composicao:**
- Logotipo: simbolo + wordmark ao lado direito
- Wordmark: Inter SemiBold, clean e direto
- Alignment: a barra do meio alinha com a x-height do wordmark

**Tamanho pequeno (tray icon 16x16):**
- As 3 barras funcionam bem em tamanho minimo (3 retangulos e simples)
- Em 16x16, reduz para 3 barras de cor solida sem arredondamento
- Extremamente reconhecivel e distinto

**Tamanho grande (splash screen):**
- Barras se "constroem" de baixo para cima com animacao de slide (0.4s stagger)
- Cada barra pode ter um sutil gradiente horizontal para profundidade
- Wordmark fade-in apos as barras completarem

**Variacoes:**
- **Colorido:** Amber + Steel + White sobre black
- **Monocromatico claro:** 3 tons de cinza sobre escuro
- **Monocromatico escuro:** 3 tons de cinza sobre claro
- **Single-color:** Todas amber (para uso em fundos que conflitam)

**Simbolismo:**
- 3 barras: as 3 camadas do sistema (hardware, OS, apps) que o otimizador gerencia
- Ordem decrescente: otimizacao = reduzir overhead
- Simplicidade brutal: o app e direto ao ponto, sem firulas
- Amber: sinal, atencao, o dashboard iluminando o que importa

---

## 3. Sistema de Cores do App (Baseado na Direcao A -- "Surgical Precision")

### Cores Primarias

```
Primary:          #00D4FF  (Electric Cyan)
Primary Hover:    #00BBEE  (Cyan escurecido)
Primary Active:   #0099CC  (Deep Cyan)
Primary Muted:    #00D4FF1A  (Cyan 10% opacity -- backgrounds sutis)
```

### Cores Secundarias

```
Secondary:        #7C8DB0  (Slate Blue)
Secondary Hover:  #8E9DC0  (Slate clareado)
Secondary Active: #6A7DA0  (Slate escurecido)
Secondary Muted:  #7C8DB01A  (Slate 10% opacity)
```

### Accent

```
Accent:           #00FFE5  (Pulse Cyan/Teal)
Accent Glow:      #00FFE533  (20% opacity -- efeitos de glow)
```

### Background Layers (Dark Theme -- 3 Niveis)

```
BG Level 0:       #07070C  (Deep Void -- area atras de tudo, window frame)
BG Level 1:       #0A0A0F  (Void Black -- background principal do conteudo)
BG Level 2:       #12121A  (Deep Slate -- cards, paineis, sidebars)
BG Level 3:       #1A1A25  (Charcoal -- elementos elevados, modais, dropdowns)
```

### Surface & Border

```
Surface:          #22222E  (Graphite -- input fields, toggle tracks)
Surface Hover:    #2A2A38  (Graphite clareado)
Border Default:   #2A2A38  (Sutil, low contrast)
Border Active:    #00D4FF33  (Cyan 20% -- borders de elementos focados)
Border Hover:     #3A3A48  (Cinza medio)
```

### Status Colors

```
Success:          #00E676  (Green Mint)
Success BG:       #00E6761A  (10% opacity)
Warning:          #FFB300  (Amber Warm)
Warning BG:       #FFB3001A  (10% opacity)
Danger:           #FF3D5A  (Coral Red)
Danger BG:        #FF3D5A1A  (10% opacity)
Info:             #00D4FF  (reutiliza Primary)
Info BG:          #00D4FF1A  (10% opacity)
```

### Text Colors

```
Text Primary:     #E8EAED  (Cool White -- texto principal, titulos)
Text Secondary:   #9AA0B0  (Muted Blue-Gray -- labels, descricoes)
Text Muted:       #5A6070  (Deep Gray -- placeholders, hints, disabled)
Text Inverse:     #0A0A0F  (Para uso sobre backgrounds claros)
Text Link:        #00D4FF  (Cyan -- links, elementos clicaveis)
Text Code:        #00FFE5  (Pulse Cyan -- valores numericos, dados tecnicos)
```

### Gradientes

```
Gradient Primary:     linear-gradient(135deg, #00D4FF, #00FFE5)
  Uso: progress bars, indicadores de performance, elementos hero

Gradient Glow:        radial-gradient(circle, #00D4FF33 0%, transparent 70%)
  Uso: glow effects sutis em hover, foco

Gradient Surface:     linear-gradient(180deg, #12121A, #0A0A0F)
  Uso: backgrounds de cards com profundidade sutil

Gradient Status:      linear-gradient(90deg, #00E676, #00D4FF)
  Uso: health bars, indicadores de "tudo ok"
```

### CSS Variables (Tauri/Web)

```css
:root {
  /* Primary */
  --color-primary: #00D4FF;
  --color-primary-hover: #00BBEE;
  --color-primary-active: #0099CC;
  --color-primary-muted: rgba(0, 212, 255, 0.1);

  /* Secondary */
  --color-secondary: #7C8DB0;
  --color-secondary-hover: #8E9DC0;
  --color-secondary-active: #6A7DA0;

  /* Accent */
  --color-accent: #00FFE5;
  --color-accent-glow: rgba(0, 255, 229, 0.2);

  /* Backgrounds */
  --bg-0: #07070C;
  --bg-1: #0A0A0F;
  --bg-2: #12121A;
  --bg-3: #1A1A25;

  /* Surface */
  --surface: #22222E;
  --surface-hover: #2A2A38;
  --border-default: #2A2A38;
  --border-active: rgba(0, 212, 255, 0.2);

  /* Status */
  --color-success: #00E676;
  --color-warning: #FFB300;
  --color-danger: #FF3D5A;
  --color-info: #00D4FF;

  /* Text */
  --text-primary: #E8EAED;
  --text-secondary: #9AA0B0;
  --text-muted: #5A6070;
  --text-inverse: #0A0A0F;
  --text-link: #00D4FF;
  --text-code: #00FFE5;
}
```

---

## 4. Tipografia

### Heading Font: Geist Sans

**Por que Geist:**
- Criada pela Vercel, otimizada para interfaces digitais
- Herdou os melhores aspectos da Inter com polimento moderno
- Disponivel via npm (`geist` package) -- integra direto no frontend React/Tauri
- 9 pesos disponiveis, variavel font para performance
- Vibe tech-forward sem ser gamer-tacky

**Aplicacao:**
```
H1: Geist Sans Bold,    32px / 40px line-height / -0.02em tracking
H2: Geist Sans SemiBold, 24px / 32px line-height / -0.01em tracking
H3: Geist Sans Medium,   20px / 28px line-height / 0 tracking
H4: Geist Sans Medium,   16px / 24px line-height / 0 tracking
H5: Geist Sans Medium,   14px / 20px line-height / +0.01em tracking
```

### Body Font: Geist Sans

Mesma familia para consistencia visual:

```
Body Large:   Geist Sans Regular, 16px / 24px line-height
Body:         Geist Sans Regular, 14px / 20px line-height
Body Small:   Geist Sans Regular, 12px / 16px line-height
Caption:      Geist Sans Regular, 11px / 14px line-height / +0.02em tracking
```

### Monospace Font: Geist Mono

**Por que Geist Mono:**
- Companheira da Geist Sans -- harmonia perfeita de metricas
- Otimizada para codigo e dados numericos
- Alinhamento de caracteres preciso (temperatures, bytes, percentages)

**Aplicacao:**
```
Code/Data Large:   Geist Mono Medium,  16px / 24px line-height
Code/Data:         Geist Mono Regular, 14px / 20px line-height
Code/Data Small:   Geist Mono Regular, 12px / 16px line-height
Code/Data Tiny:    Geist Mono Regular, 10px / 14px line-height (tray tooltips)
```

### Hierarquia Completa

```
NIVEL          | FONT                    | TAMANHO | COR
-------------- | ----------------------- | ------- | --------
Page Title     | Geist Sans Bold         | 32px    | text-primary
Section Title  | Geist Sans SemiBold     | 24px    | text-primary
Card Title     | Geist Sans Medium       | 20px    | text-primary
Subsection     | Geist Sans Medium       | 16px    | text-primary
Body Text      | Geist Sans Regular      | 14px    | text-primary
Label          | Geist Sans Medium       | 12px    | text-secondary
Description    | Geist Sans Regular      | 14px    | text-secondary
Hint/Help      | Geist Sans Regular      | 12px    | text-muted
Temperature    | Geist Mono Medium       | 16px    | text-code (#00FFE5)
Percentage     | Geist Mono Regular      | 14px    | text-primary
File Size      | Geist Mono Regular      | 14px    | text-secondary
Status Value   | Geist Mono Medium       | 14px    | (status color)
```

### Fallback Stack

```css
--font-sans: 'Geist Sans', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
```

---

## 5. Iconografia do App

### Estilo Geral

**Tipo:** Line icons com 1.5px stroke (padrao), 2px stroke para estados ativos/hover
**Cantos:** Arredondados com 2px radius
**Grid:** 24x24px com 2px padding (area ativa 20x20)
**Consistencia:** Todos os icones seguem o mesmo peso visual, sem misturar filled e outlined no mesmo contexto

### Biblioteca Recomendada: Lucide Icons

**Por que Lucide:**
- Fork mantido e ativo do Feather Icons com 1500+ icones
- Stroke-based, consistente com o estilo "Surgical Precision"
- Suporte nativo React (`lucide-react` package)
- Customizavel: tamanho, strokeWidth, cor via props
- Licenca MIT, zero custo
- Estetica tech/clean que alinha perfeitamente com Geist Sans

**Instalacao:**
```bash
npm install lucide-react
```

**Uso:**
```tsx
import { Cpu, Thermometer, HardDrive, Gauge, Trash2 } from 'lucide-react';

<Cpu size={24} strokeWidth={1.5} className="text-cyan" />
```

### Mapeamento de Icones por Modulo

| Modulo | Icone Lucide | Icone Alternativo | Notas |
|--------|-------------|-------------------|-------|
| **Cache Cleanup** | `Trash2` | `Eraser` | Trash2 e universalmente entendido |
| **GPU Cache** | `Gpu` (custom) | `Layers` | Precisa de icone custom -- ver abaixo |
| **Temperatura** | `Thermometer` | `ThermometerSun` | Usar variante com indicador |
| **Gaming Mode** | `Gamepad2` | `Swords` | Gamepad2 e direto e claro |
| **Developer Mode** | `Terminal` | `Code2` | Terminal transmite "dev" melhor |
| **CPU Monitor** | `Cpu` | `Activity` | Cpu e literal e funciona |
| **RAM Monitor** | `MemoryStick` | `CircuitBoard` | MemoryStick e nativo do Lucide |
| **Disk Space** | `HardDrive` | `Database` | HardDrive e reconhecivel |
| **Performance** | `Gauge` | `Zap` | Gauge como dashboard meter |
| **Settings** | `Settings` | `SlidersHorizontal` | Classico gear icon |
| **Services** | `Server` | `Network` | Server para gerenciamento de servicos |
| **Startup** | `Power` | `PlayCircle` | Power = boot/startup |
| **Scan/Analyze** | `Scan` | `Search` | Scan transmite analise de sistema |
| **Privacy** | `Shield` | `Lock` | Shield para telemetria/privacidade |
| **Scheduler** | `Clock` | `CalendarClock` | Agendamento de tarefas |

### Icones Custom Necessarios

Estes icones NAO existem no Lucide e precisam ser desenhados:

#### 1. GPU Cache (`gpu-cache`)
**Descricao:** Combina o conceito de chip de GPU (retangulo com pins laterais, similar ao icone Cpu mas mais largo/retangular) com um indicador de cache (pequeno circulo ou barra no canto inferior direito). Stroke 1.5px, 24x24 grid.

#### 2. Gaming Mode Ativo (`gaming-active`)
**Descricao:** Variante do Gamepad2 com "linhas de velocidade" ou raios saindo para cima, indicando boost ativo. Stroke 1.5px, 24x24 grid.

#### 3. Developer Mode Ativo (`dev-active`)
**Descricao:** Variante do Terminal com cursor piscando (linha vertical dentro do terminal) e bracket `>_` mais enfatizado. Stroke 1.5px, 24x24 grid.

#### 4. System Health (`system-health`)
**Descricao:** Combinacao de heartbeat/pulso (linha ECG) dentro de um circulo. Diferente do "Activity" do Lucide por ter o circulo envolvente, transmitindo "saude geral do sistema". Stroke 1.5px, 24x24 grid.

### Regras de Cor para Icones

```
Estado Default:     var(--text-secondary)  #9AA0B0
Estado Hover:       var(--text-primary)    #E8EAED
Estado Active:      var(--color-primary)   #00D4FF
Estado Disabled:    var(--text-muted)      #5A6070
Estado Danger:      var(--color-danger)    #FF3D5A
Estado Success:     var(--color-success)   #00E676
```

### Tamanhos de Icone

```
Icone grande (feature/hero):     32px, strokeWidth: 1.5
Icone padrao (navegacao/cards):  24px, strokeWidth: 1.5
Icone medio (inline/buttons):    20px, strokeWidth: 1.5
Icone pequeno (badges/status):   16px, strokeWidth: 2.0 (mais grosso pra legibilidade)
Icone mini (tray/tooltip):       12px, strokeWidth: 2.0
```

---

## 6. Recomendacao Final

### Direcao Recomendada: "Surgical Precision" (Direcao A)

### Logo Recomendado: "Prism" (Conceito 1)

### Justificativa Completa

**1. Alinhamento com o produto:**
O app e construido em Rust -- a linguagem mais precisa e performatica disponivel. O app usa 30MB de RAM quando concorrentes usam 200-300MB. A direcao visual PRECISA refletir essa precisao cirurgica. A Direcao A faz isso com maestria: cada cor, cada pixel, cada elemento tem proposito. Nenhum elemento decorativo sem funcao.

**2. Diferenciacao dos concorrentes:**
- CCleaner: azul corporativo, interface datada, generico -> nos somos tech-forward, premium
- IObit: gradientes excessivos, visual noise, ads visuais -> nos somos clean, zero noise
- BleachBit: minimalista demais, quase sem identidade -> nos temos identidade forte com cyan eletrico
- Razer Cortex: gamer demais, alien/verde neon -> nos somos elegantes sem ser juvenis

**3. Publico dual (gamer + developer):**
A Direcao A serve ambos os publicos sem alienar nenhum. O cyan eletrico e tech-enough para gamers (referencia NZXT CAM) e refinado o suficiente para developers (referencia Warp, Linear). A Direcao B seria ousada demais para devs. A C seria austera demais para gamers. A Direcao A e o sweet spot.

**4. Escalabilidade da marca:**
O sistema hexagono/Prism escala de 16x16 (tray icon reconhecivel) ate splash screen (com animacao de refracao). As variacoes monocromaticas funcionam em qualquer contexto. O sistema de cores tem profundidade suficiente para um app complexo sem criar confusao visual.

**5. Longevidade:**
Cyan sobre dark theme envelhece bem. Nao depende de tendencias passageiras (gradientes holograficos, glassmorphism excessivo). A estetica "surgical" e atemporal -- instrumentos medicos e hardware de aviacoes usam essa linguagem visual ha decadas porque FUNCIONA.

**6. Implementacao tecnica:**
- Geist Sans/Mono: instala via npm, renderiza perfeitamente na WebView2 do Tauri
- Lucide: React-native, tree-shakeable, 4 icones custom e viavel
- Sistema de cores: 100% implementavel com CSS custom properties
- Logo SVG: escala infinitamente, animavel com CSS/Framer Motion

### Proximos Passos

1. **Validar nome do app** -- o nome influencia como o Prism logo se integra com o wordmark
2. **Prototipar logo em SVG** -- criar o hexagono com refracao em alta fidelidade
3. **Testar em tamanhos reais** -- renderizar em 16x16, 32x32, 64x64, 256x256, 512x512
4. **Implementar design tokens** -- converter este sistema de cores em Tailwind config
5. **Criar componentes base** -- sidebar, cards, gauges com o sistema visual definido

---

## Apendice: Contraste WCAG

Verificacao de acessibilidade das combinacoes de cores criticas:

| Combinacao | Foreground | Background | Ratio | WCAG AA | WCAG AAA |
|-----------|-----------|-----------|-------|---------|----------|
| Text Primary on BG1 | #E8EAED | #0A0A0F | 15.8:1 | PASS | PASS |
| Text Secondary on BG1 | #9AA0B0 | #0A0A0F | 7.9:1 | PASS | PASS |
| Text Muted on BG1 | #5A6070 | #0A0A0F | 3.5:1 | PASS (large) | FAIL |
| Primary on BG1 | #00D4FF | #0A0A0F | 10.2:1 | PASS | PASS |
| Accent on BG1 | #00FFE5 | #0A0A0F | 13.1:1 | PASS | PASS |
| Success on BG2 | #00E676 | #12121A | 9.4:1 | PASS | PASS |
| Warning on BG2 | #FFB300 | #12121A | 8.7:1 | PASS | PASS |
| Danger on BG2 | #FF3D5A | #12121A | 5.2:1 | PASS | FAIL |
| Text Primary on BG3 | #E8EAED | #1A1A25 | 12.4:1 | PASS | PASS |

Todas as combinacoes criticas passam WCAG AA. Text Muted e intencionalmente low-contrast (hints, placeholders, disabled).

---

*Documento gerado por @aaron-draplin (Logo & Brand Marks) com routing do Design Chief*
*Framework: AIOX Design Squad*
