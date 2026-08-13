# Plano semanal — refeições compostas e janela deslizante

Estado: **construído — as três fases.** Documento de referência da implementação.

## Problema

Hoje o plano semanal só sabe representar *uma receita por slot*, e essa receita
tem de ser `[Categoria] Completa`:

- `src/hooks/usePlannedMeals.ts:6-15` — `PlannedSlot.recipeId: number | null`
- `src/utils/weekPlanSlots.ts:46` — `completaRecipes()` filtra o pool de sugestões
- `src/components/MealPickSheet.tsx:41` — o "Escolher" também só lista Completas

Uma refeição portuguesa real é sopa + prato + sobremesa + bebida. Nada disso cabe
no modelo, e por isso o custo (€) e as macros do plano estão sistematicamente
subestimados — a bebida e a sobremesa são invisíveis.

Em segundo lugar, o plano **apaga-se todas as noites**
(`usePlannedMeals.ts:65` e `:105`: se `weekStart !== today`, devolve `[]`). Como
o `dayOffset` é relativo a hoje, mesmo sem apagar os dias mudariam de significado
à meia-noite. Para uma página chamada "Plano da semana" isto é fatal.

## Decisões fechadas

1. **O slot passa a ser uma composição**, não uma receita. Papéis: `sopa`,
   `prato`, `sobremesa`, `bebida`. Só `prato` é obrigatório.
2. **O papel deriva de `[Categoria]`** — sem campo novo no formato de descrição.
   A fruta entra em `Sobremesa`; não há papel `fruta`.
3. **Sem pequeno-almoço nem lanches nesta fase.** Continuam só `almoco` e
   `jantar`. `Ligeira` é a categoria do pequeno-almoço e dos lanches, **não** uma
   opção de prato — quando essas refeições entrarem, entram como *slots* novos
   alimentados por `Ligeira`, não como papéis dentro de almoço/jantar.
4. **O plano nunca faz reset.** Slots ancorados a datas absolutas, janela
   deslizante de 7 dias para trás e até 7 para a frente, ordenada do mais recente
   (topo) para o mais antigo (fundo).
5. **Sopa/sobremesa/bebida são receitas mínimas**, criadas automaticamente a
   partir dos produtos da Despensa ("A + atalho"). Não se introduz um segundo
   tipo de entidade no plano.
6. **Dias passados são editáveis, mas sem sugestões nem "Aceitar"** — servem para
   corrigir o registo do que realmente se comeu, não para planear.

---

## 1. Modelo de dados

### 1.1 Slot vivo (`usePlannedMeals.ts`)

```ts
export type MealSlot = 'almoco' | 'jantar'
export type PartRole = 'sopa' | 'prato' | 'sobremesa' | 'bebida'
export type SlotSource = 'accepted' | 'chosen' | 'dismissed'

export interface SlotPart {
  role: PartRole
  recipeId: number
}

export interface PlannedSlot {
  /** ISO `yyyy-mm-dd`. Absoluto — nunca relativo a hoje. */
  date: string
  slot: MealSlot
  /** No máximo uma parte por papel. Vazio ⟺ dispensado. */
  parts: SlotPart[]
  source: SlotSource
}
```

`slotHasMeal()` passa a significar "tem uma parte com papel `prato`". Um slot só
com bebida não conta como refeição decidida — para sugestões, para os totais e
para o `visibleDayCount`.

O `StoredPlan.weekStart` desaparece. A poda passa a ser: descartar slots com
`date < hoje - 7 dias`, feita no `load()`.

### 1.2 Papéis ↔ categorias (`src/utils/mealRole.ts`, novo)

| `[Categoria]` | Papel                        |
| ------------- | ---------------------------- |
| `Completa`    | `prato`                      |
| `Sopa`        | `sopa`                       |
| `Sobremesa`   | `sobremesa`                  |
| `Bebida`      | `bebida`                     |
| `Ligeira`     | — *(pequeno-almoço/lanche)*  |

`[Categoria]` está a fazer dois trabalhos ao mesmo tempo, e convém ter isso
explícito: `Completa` e `Ligeira` dizem **em que refeição do dia** a receita cabe,
enquanto `Sopa`/`Sobremesa`/`Bebida` dizem **que parte da refeição** ela é. Não
colide porque uma receita nunca é as duas coisas, e o campo continua a ser um só.
Quando os slots de pequeno-almoço e lanche chegarem, `Ligeira` alimenta-os pelo
primeiro eixo — nunca aparece como prato de almoço ou jantar.

```ts
export function roleForCategory(category: string | null): PartRole | null
export const CATEGORIES_FOR_ROLE: Record<PartRole, string[]>
export const ROLE_ORDER: PartRole[]   // sopa → prato → sobremesa → bebida
export const ROLE_LABEL: Record<PartRole, string>
export const ROLE_EMOJI: Record<PartRole, string>   // 🥣 🍽️ 🍎 🥤
```

Uma receita sem categoria reconhecida não é elegível para nenhum papel — igual ao
comportamento actual, em que só `Completa` entra no plano.

### 1.3 Migração dos dados guardados

`normalizeSlot()` (em `usePlannedMeals.ts` **e** em `savedWeekPlans.ts`) aceita as
duas formas. Ao ler a forma antiga:

- `recipeId: N` → `parts: [{ role: 'prato', recipeId: N }]`
- `recipeId: null` + `source: 'dismissed'` → `parts: []`
- `dayOffset: k` + o `weekStart` guardado → `date = weekStart + k dias`
  (só no plano vivo; os templates mantêm `dayOffset`, ver §3)

Migração silenciosa na leitura, sem escrita de compatibilidade: assim que o
utilizador mexe no plano, grava-se no formato novo.

---

## 2. Janela deslizante

### 2.1 Ordem e limites

```
▲  Amanhã · Domingo               ← por planear
   HOJE · Sábado                  ← a comer
   ══════════════════════════════
   Ontem · Sexta            ✓ ✓   ← já comido
   Quinta                   ✓
   Terça                          ← planeado e não registado
▼  (nada além de 7 dias atrás)
```

- **Para a frente:** mantém-se a revelação progressiva que já existe
  (`visibleDayCount`) — o dia *k+1* só aparece depois de o dia *k* ter alguma
  coisa, até ao máximo de 7. A função passa a operar sobre datas.
- **Para trás:** 7 dias de janela, mas **só se renderizam os dias com conteúdo**.
  Sete linhas vazias por baixo de hoje não informam nada; um utilizador novo vê
  apenas hoje. O fundo da lista cresce sozinho à medida que se come.
- **Separador visual** entre hoje e ontem, para o passado não se confundir com o
  que ainda está por decidir.

### 2.2 A fronteira futuro / passado

Esta é a linha arquitetural mais importante do redesenho:

| | Fonte de verdade | Onde vive |
| --- | --- | --- |
| Hoje + futuro | **plano** | `localStorage` (`usePlannedMeals`) |
| Passado | **registo** | Grocy `meal_plan` |

Os dias passados renderizam-se a partir da **união** dos dois: slots que ficaram
em `localStorage` (planeados, até 7 dias) e entradas de `meal_plan` (o que foi
mesmo registado, incluindo o que foi logado a partir da Home sem passar pelo
plano). Uma entrada de `meal_plan` marca o ✓; um slot planeado sem entrada
correspondente aparece sem ✓ — o que é informação útil, não um erro.

Editar um dia passado escreve directamente em `meal_plan` via `grocy.logMeal`
com o `day` desse dia, não em `localStorage`.

### 2.3 Atribuição almoço/jantar no `meal_plan`

`MealPlanEntry` (`src/types/grocy.ts:81`) só tem `day`, `recipe_id` e `note` — não
distingue almoço de jantar. Solução: estender o `encodeMealLogNote()`
(`src/utils/mealLogAttribution.ts`), que já codifica `{ owner, share }`, com um
campo `slot`. Para entradas antigas sem essa marca, deduz-se de
`row_created_timestamp` através de `currentMealSlot()`
(`logMealConsumption.ts:49` — antes das 15:00 é almoço).

---

## 3. Templates (`savedWeekPlans.ts`)

Um plano guardado é um molde reutilizável, por isso **tem de continuar
relativo** — datas absolutas tornariam "Semana Barata" inaplicável na semana
seguinte. `SavedWeekPlan.slots` deixa de partilhar o tipo com o plano vivo:

```ts
export interface TemplateSlot {
  dayOffset: number       // 0..6
  slot: MealSlot
  parts: SlotPart[]
}
```

- `planFromSlots()` — só guarda **hoje e o futuro**; os dias passados são registo,
  não molde. `dayOffset` calcula-se a partir de hoje.
- `applicableSlots()` / `applyPlanSlots()` — mapeiam `dayOffset` → `hoje + k`, e
  continuam a descartar partes cuja receita já não existe (agora parte a parte,
  não slot a slot: perder a bebida não deve deitar fora o prato).
- `summarizePlan()` — `meals` conta slots com `prato`; `spend` e
  `distinctRecipes` somam **todas** as partes.

---

## 4. Escolher partes — o atalho da Despensa

`MealPickSheet` ganha uma prop `role: PartRole` e muda de comportamento:

**`role === 'prato'`** — exactamente o que existe hoje: só `Completa`, com o
filtro Cozinha/Restaurante intacto. As `Ligeira` ficam de fora de propósito.

**Restantes papéis** — duas secções:

1. **Já usadas** — receitas com a categoria do papel, ordenadas por utilização
   recente (reaproveitar `mealAccess.ts`). A "habitual" fica no topo.
2. **Da despensa** — produtos do grupo Despensa que ainda não têm receita
   correspondente. Escolher um **cria a receita mínima na hora**.

### 4.1 Criação da receita mínima (`src/utils/createPartRecipe.ts`, novo)

```ts
grocy.createRecipe({
  name: product.name,
  description: buildDescription({
    ingredientRows: [{ id: 0, name: product.name, price: '', grams: String(grams) }],
    steps: '',
    nutrition: { calories: '', protein: '', carbs: '', fat: '' },
    priceOverride: '',
    autoTotal: 0,
    category: CATEGORY_FOR_ROLE[role],   // 'Sobremesa' | 'Bebida' | 'Sopa'
    origin: 'supermercado',
  }),
})
```

O nome tem de bater certo com o do produto: `makeProductMacroLookup()`
(`recipeNutrition.ts:26`) faz correspondência **exacta** (sem acentos, sem
maiúsculas) e é deliberadamente não-difusa. Usar `product.name` tal e qual
garante que as macros derivam à primeira.

**Gramas** — a sheet pede o valor num campo numérico pré-preenchido por papel
(sobremesa 150 g, bebida 250 ml, sopa 300 ml). É o toque extra que faz as macros
serem reais em vez de zero.

**Preço** — fica vazio de início. Derivar €/porção a partir de gramas × €/kg é
possível com o que existe em `storePrices.ts`, mas fica para depois; entretanto
edita-se a receita à mão como qualquer outra.

**Foto** — a receita nasce sem foto (cai no 🍽️ do cartão). As fotos de produto
vivem em `productpictures` e as de receita em `recipepictures`, grupos
diferentes do Grocy, por isso reaproveitar implicaria copiar o ficheiro. Fora de
âmbito nesta fase.

### 4.2 Habituais (`src/utils/partHabits.ts`, novo)

`localStorage` por perfil, no molde do `planOriginsMemory.ts`: guarda o último
`recipeId` usado por papel. O chip vazio mostra directamente o habitual
(`+ 🍎 Maçã`) — um toque preenche; o "…" abre a sheet completa.

---

## 5. UI do cartão

Quatro cartões por refeição × 2 refeições × 14 dias é uma parede. O cartão actual
continua a ser o prato, com uma fila compacta de chips por baixo:

```
┌──────────────────────────────────────┐
│ ALMOÇO                               │
│ [img] Bitoque                     ✕  │
│       870 kcal · €3.10               │  ← total do slot, todas as partes
│ ──────────────────────────────────── │
│ 🥣 Sopa de legumes  🍎 Maçã  + 🥤    │
└──────────────────────────────────────┘
```

- Chip preenchido → toca para trocar, ✕ pequeno para remover.
- Chip vazio → `+ Papel`, ou o habitual quando existe.
- O total (kcal, €) do cabeçalho passa a somar todas as partes.
- Um slot **sem prato** mas com partes mostra as sugestões normalmente para o
  prato — a composição não bloqueia o motor de sugestões.
- Dias passados: cartão esbatido, sem "Aceitar"/"Outra", sem sugestões, com ✓ por
  parte registada. Os chips continuam a funcionar para corrigir o registo.

---

## 6. Nutrição, custo e sugestões

- `daySpend()`, `runningFromSlots()`, `sumRecipesNutrition()`
  (`weekPlanSlots.ts:106-135`) percorrem partes em vez de um `recipeId`.
- `MEAL_SHARE = 0.5` mantém-se e passa a ser honesto: o slot é agora a refeição
  inteira, não só o prato.
- `MacroSummaryBar days={…}` — hoje é `Math.ceil(slots.length / 2)`
  (`WeeklyPlan.tsx:854`), que conta slots e inclui dispensados. Passa a contar
  datas distintas **de hoje para a frente** com pelo menos um prato; o passado
  não deve diluir a média do plano.
- `buildSlotSuggestions()` — sugere **apenas o prato**, e apenas para slots de
  hoje ou futuros. O pool de sugestões mantém-se `Completa` (inalterado). Sopa,
  sobremesa e bebida não são pontuadas: resolvem-se por habitual + escolha
  manual.

---

## 7. Consumo e lista de compras

- **"Comi"** — novo `logSlotConsumption(parts, recipes)` que corre
  `logMealConsumption()` por cada parte, mantendo o decremento de porções com
  rollback que já existe (`logMealConsumption.ts:25-43`). Falha parcial reporta
  que partes falharam, em vez de um "Erro" opaco.
- **"Adicionar à lista"** — `findIngredientShoppingNeeds()`
  (`plannedMealsShopping.ts:14`) já recebe `Recipe[]`; passa a receber as receitas
  de **todas** as partes do slot. A deduplicação por `productId` que já lá está
  trata do resto.

---

## 8. Onde é que sopas e acompanhamentos vivem

- `AddMeal.tsx:66-70` passa a aceitar `?type=sopa|sobremesa|bebida`.
- `AddMenu.tsx` ganha **um** mosaico novo, "Sopa" — uma sopa a sério tem
  ingredientes e passos e merece o formulário completo. Sobremesas e bebidas
  nascem do atalho da Despensa e não precisam de entrada própria.
- `Home.tsx` **não** ganha separador novo nesta fase; as receitas de papel
  chegam-se pelos chips do plano e por `/meal/:id`. Um separador "Sopas"
  acrescenta-se depois, se a biblioteca crescer.

---

## 9. Fases

**Fase 1 — modelo e janela. ✅** `PlannedSlot` com `date` + `parts`, migração dos
dois normalizadores, poda a 7 dias, fim do reset, templates relativos, ordem
invertida na lista. Sem UI de composição ainda: cada slot mostra só o `prato`.
Testes: migração, poda, mudança de dia, ida e volta dos templates.

**Fase 2 — composição. ✅** `mealRole.ts`, chips no cartão
(`SlotPartChips.tsx`), `MealPickSheet` por papel, atalho da Despensa +
`createPartRecipe`, habituais (`partHabits.ts`), totais por slot (`slotTotals`),
`logSlotConsumption` e lista de compras a percorrer partes, `?type=` no AddMeal
e mosaico "Sopa" no AddMenu.

Dois desvios ao que estava escrito, ambos deliberados:

- `setPart` **preserva o `source`** quando a parte não é o prato. `source`
  descreve como o prato foi decidido, e juntar uma bebida não deve reescrever
  um slot `accepted` para `chosen`.
- O `excludeIds` da sheet **só se aplica ao prato**. Os acompanhamentos existem
  para repetir — esconder a água depois do primeiro uso seria o contrário do
  que se quer.

**Fase 3 — passado. ✅** Fusão com `meal_plan` (`pastPlan.ts`), ✓ por parte,
cartões esbatidos, `slot` codificado na `note` com fallback pelo
`row_created_timestamp`, edição de dias passados a escrever em Grocy.

Decisões que o doc não cobria e tiveram de ser tomadas:

- **Colisão de papel.** Se o plano dizia Bitoque e o registo diz Bacalhau, o
  registo ganha o chip — foi o que se comeu. Dois registos a disputar o mesmo
  papel é o único caso que não se consegue desenhar: o mais antigo fica com o
  chip, o outro mantém o ✓ na lista de registados.
- **Receita sem papel** (uma `Ligeira` registada a partir da Home) ocupa o
  lugar do prato no passado. A regra que mantém `Ligeira` fora dos pratos rege
  o *planeamento*, não o *registo*.
- **Visibilidade por perfil.** O passado passa pelo `isMealLogVisibleToProfile`,
  como no History — o plano não se deve encher com o que o resto da casa comeu.
- **`slot` preservado no History.** Reclamar ou partilhar uma refeição reencoda
  a `note`; sem cuidado apagaria a marca de almoço/jantar.

## Não-objectivos

Slots de pequeno-almoço e lanche (é onde as `Ligeira` vão dar, mas não agora).
Sugestão automática de sopa/sobremesa/bebida. Preço
derivado de €/kg. Fotos herdadas do produto. Partilha do plano entre perfis da
família.

## Riscos

- **Duas migrações num só `PlannedSlot`** (`dayOffset`→`date` e
  `recipeId`→`parts`). É deliberado — separá-las obrigaria a duas migrações de
  dados em vez de uma — mas é o ponto onde os testes têm de ser sérios.
- **Nome do produto ≠ nome da receita** parte as macros derivadas em silêncio. A
  criação automática elimina o risco no caminho novo, mas receitas mínimas
  criadas à mão continuam expostas.
- **Volume vertical.** Sete dias para trás com quatro chips cada pode tornar a
  página pesada. Mitigação: só renderizar dias passados com conteúdo; se ainda
  assim crescer demasiado, colapsar o passado atrás de um "Ver anteriores".
