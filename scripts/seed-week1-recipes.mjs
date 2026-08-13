#!/usr/bin/env node
/**
 * Seed the week-1 recipes from docs/plano-alimentar.md into Grocy.
 *
 * Env: GROCY_HOST (host:port), GROCY_API_KEY
 *
 *   node scripts/seed-week1-recipes.mjs            # dry run — prints, writes nothing
 *   node scripts/seed-week1-recipes.mjs --apply    # actually creates the recipes
 *
 * Idempotent: a recipe whose name already exists in Grocy is skipped, so
 * re-running never duplicates. Nothing is ever updated or deleted.
 *
 * Ingredient lines use the app's `Nome|preco|gramas` format, so recipe
 * nutrition is derived from product macros rather than guessed. Prices are
 * starting estimates — the real ones come from scanning receipts.
 */

const GROCY_HOST = process.env.GROCY_HOST || '192.168.1.61:9192'
const API_KEY = process.env.GROCY_API_KEY
const APPLY = process.argv.includes('--apply')

if (!API_KEY) {
  console.error('GROCY_API_KEY required')
  process.exit(1)
}

const base = GROCY_HOST.startsWith('http') ? GROCY_HOST : `http://${GROCY_HOST}`

async function api(path, options = {}) {
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      'GROCY-API-KEY': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} → ${res.status} ${await res.text()}`)
  }
  return res.status === 204 ? null : res.json()
}

/** name, price (€ for the whole recipe), grams */
const RECIPES = [
  {
    name: 'Frango assado com batata-doce e brócolos',
    category: 'Completa',
    portions: 4,
    time: 50,
    ingredients: [
      ['Frango inteiro', 6.0, 1400],
      ['Batata-doce', 2.0, 800],
      ['Brócolos', 1.5, 400],
      ['Cebola', 0.3, 150],
      ['Azeite', 0.2, 30],
    ],
    steps: [
      'Forno a 200 °C.',
      'Frango inteiro num tabuleiro. Esfrega com azeite, sal, pimenta, colorau e alho em pó.',
      'À volta: batata-doce em cubos grandes e cebola em gomos, regados com azeite e sal.',
      '50 min no forno. Aos 30 min vira as batatas.',
      'Brócolos: cozer 5 min em água a ferver com sal. Escorrer, azeite e limão.',
      'Guardar a carcaça no congelador para a canja.',
    ],
    notes: 'A carcaça vira canja — não deitar fora.',
  },
  {
    name: 'Sopa de feijão com couve e massa',
    category: 'Ligeira',
    portions: 8,
    time: 40,
    ingredients: [
      ['Feijão encarnado cozido', 0.8, 400],
      ['Couve portuguesa', 1.0, 400],
      ['Batata', 0.6, 400],
      ['Cenoura', 0.4, 200],
      ['Cebola', 0.3, 150],
      ['Massa pequena', 0.4, 100],
      ['Azeite', 0.3, 40],
      ['Alho', 0.1, 10],
    ],
    steps: [
      'Refogar em azeite: cebola picada, alho e cenoura às rodelas. 5 min.',
      'Juntar batata em cubos, louro, sal, e água até cobrir bem (~2 L).',
      'Ferver 15 min, até a batata estar macia.',
      'Juntar o feijão escorrido, a couve cortada fina e uma mão de massa pequena.',
      'Mais 8-10 min. Provar o sal. Azeite cru por cima no prato.',
    ],
    notes: 'Não passar — é suposto ter pedaços.',
  },
  {
    name: 'Omelete de legumes',
    category: 'Completa',
    portions: 2,
    time: 10,
    ingredients: [
      ['Ovos', 0.9, 250],
      ['Curgete', 0.5, 200],
      ['Cebola', 0.2, 100],
      ['Pão integral', 0.4, 120],
      ['Azeite', 0.15, 20],
    ],
    steps: [
      'Bater 5 ovos com sal e pimenta.',
      'Frigideira com azeite: cebola picada e curgete aos cubos. 5 min.',
      'Deitar os ovos por cima, lume médio-baixo.',
      'Quando estiver quase firme, dobrar ao meio.',
      'Servir com pão integral e salada.',
    ],
  },
  {
    name: 'Salada de grão com atum e ovo',
    category: 'Completa',
    portions: 2,
    time: 10,
    ingredients: [
      ['Grão cozido', 0.9, 400],
      ['Atum', 2.0, 160],
      ['Tomate', 0.5, 200],
      ['Ovos', 0.36, 100],
      ['Azeite', 0.2, 25],
      ['Cebola', 0.15, 80],
    ],
    steps: [
      'Cozer 2 ovos (8 min a ferver). Arrefecer em água fria e descascar.',
      'Escorrer o grão e passar por água.',
      'Misturar com o atum escorrido, tomate aos cubos, cebola picada fina e salsa.',
      'Temperar com azeite, sumo de limão, sal e pimenta.',
      'Ovo aos gomos por cima.',
    ],
  },
  {
    name: 'Massa com atum e tomate',
    category: 'Completa',
    portions: 4,
    time: 20,
    ingredients: [
      ['Esparguete', 1.0, 400],
      ['Atum', 2.0, 160],
      ['Tomate pelado', 0.8, 400],
      ['Curgete', 0.5, 200],
      ['Cebola', 0.2, 100],
      ['Azeite', 0.2, 25],
      ['Alho', 0.1, 10],
    ],
    steps: [
      'Massa a cozer em água a ferver com sal.',
      'À parte: azeite, cebola e alho picados. 5 min.',
      'Juntar o tomate, a curgete aos cubos, louro, sal e pimenta. 10 min.',
      'Juntar o atum escorrido no fim, só para aquecer.',
      'Misturar com a massa escorrida.',
    ],
  },
  {
    name: 'Sardinha na air fryer com batata e salada',
    category: 'Completa',
    portions: 2,
    time: 25,
    ingredients: [
      ['Sardinha', 3.0, 500],
      ['Batata', 0.6, 500],
      ['Alface', 0.6, 150],
      ['Tomate', 0.4, 150],
      ['Azeite', 0.15, 20],
    ],
    steps: [
      'Batatas com pele a cozer em água com sal, ~20 min.',
      'Sardinhas bem secas com papel, sal grosso generoso dos dois lados.',
      'Air fryer a 200 °C, 8-10 min, virar a meio.',
      'Servir com as batatas, salada de alface e tomate, azeite e limão.',
    ],
  },
  {
    name: 'Canja com grão',
    category: 'Ligeira',
    portions: 6,
    time: 30,
    ingredients: [
      ['Carcaça de frango', 0, 400],
      ['Grão cozido', 0.9, 400],
      ['Cenoura', 0.4, 200],
      ['Massa pequena', 0.4, 100],
      ['Cebola', 0.2, 100],
    ],
    steps: [
      'Carcaça do frango numa panela com ~1,5 L de água, cebola inteira, cenoura, louro e sal. Ferver 20 min.',
      'Coar o caldo. Aproveitar os pedaços de carne que restarem.',
      'Voltar ao lume com cenoura aos cubos, grão escorrido e massa pequena.',
      '10 min. Juntar a carne. Hortelã ou limão no fim.',
    ],
    notes: 'Feita com a carcaça do frango assado — custo quase zero.',
  },
  {
    name: 'Arroz de feijão com couve',
    category: 'Completa',
    portions: 4,
    time: 35,
    ingredients: [
      ['Arroz', 0.6, 300],
      ['Feijão encarnado cozido', 0.8, 400],
      ['Couve portuguesa', 0.8, 300],
      ['Cebola', 0.2, 100],
      ['Azeite', 0.2, 25],
      ['Alho', 0.1, 10],
    ],
    steps: [
      'Refogar cebola e alho em azeite. Juntar colorau e louro.',
      'Juntar o feijão escorrido e a couve cortada fina. 5 min.',
      'Juntar o arroz e o dobro e meio de água a ferver. Sal.',
      'Lume brando, tapado, 15 min. Descansar 5 min fora do lume.',
    ],
    notes: 'Com um ovo cozido por cima sobe para ~23 g de proteína por dose.',
  },
  {
    name: 'Jardineira de frango',
    category: 'Completa',
    portions: 4,
    time: 50,
    ingredients: [
      ['Frango', 4.0, 700],
      ['Batata', 0.8, 600],
      ['Ervilhas congeladas', 1.0, 300],
      ['Cenoura', 0.5, 250],
      ['Cebola', 0.25, 120],
      ['Azeite', 0.2, 25],
    ],
    steps: [
      'Refogar cebola e alho em azeite. Alourar o frango aos pedaços.',
      'Juntar cenoura e batata em cubos grandes, louro, sal e pimenta.',
      'Água até quase cobrir. Cozer em lume brando 25 min.',
      'Juntar as ervilhas nos últimos 8 min.',
    ],
  },
]

function buildDescription(recipe) {
  const total = recipe.ingredients.reduce((sum, [, price]) => sum + price, 0)

  const lines = recipe.ingredients.map(([name, price, grams]) =>
    price > 0 ? `${name}|${price.toFixed(2)}|${grams}` : `${name}||${grams}`
  )

  const parts = [
    `[Ingredientes]\n${lines.join('\n')}`,
    `[Passos]\n${recipe.steps.join('\n')}`,
    `[Preco]\n${total.toFixed(2)}`,
    `[Categoria]\n${recipe.category}`,
    `[Origem]\nsupermercado`,
    `[Porcoes]\n0`,
    `[Tempo]\n${recipe.time}`,
  ]
  if (recipe.notes) parts.push(`[Notas]\n${recipe.notes}`)

  return { description: parts.join('\n\n'), total }
}

async function main() {
  const existing = await api('/objects/recipes')
  const existingNames = new Set(existing.map((r) => r.name.trim().toLowerCase()))

  let created = 0
  let skipped = 0

  for (const recipe of RECIPES) {
    const { description, total } = buildDescription(recipe)
    const perPortion = total / recipe.portions

    if (existingNames.has(recipe.name.trim().toLowerCase())) {
      console.log(`  skip   ${recipe.name} (já existe)`)
      skipped++
      continue
    }

    console.log(
      `  ${APPLY ? 'create' : 'would '} ${recipe.name} — ` +
        `${recipe.portions} doses, €${total.toFixed(2)} (€${perPortion.toFixed(2)}/dose), ${recipe.time} min`
    )

    if (APPLY) {
      await api('/objects/recipes', {
        method: 'POST',
        body: JSON.stringify({
          name: recipe.name,
          description,
          base_servings: 1,
          desired_servings: 1,
          not_check_shoppinglist: 0,
        }),
      })
      created++
    }
  }

  console.log()
  if (APPLY) {
    console.log(`Criadas ${created} receitas, ${skipped} já existiam.`)
  } else {
    console.log(
      `Dry run: ${RECIPES.length - skipped} a criar, ${skipped} já existem. ` +
        `Corre com --apply para escrever no Grocy.`
    )
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
