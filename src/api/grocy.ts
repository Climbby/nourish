import type {
  AddStockOptions,
  MealPlanEntry,
  PriceHistoryPoint,
  Product,
  QuantityUnit,
  Recipe,
  RecipeIngredient,
  ShoppingListItem,
  StockItem,
  StockLogEntry,
} from '../types/grocy'
import { grocyConfig } from '../config/grocy'

function convertToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('WebP conversion failed'))
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Grocy ${res.status}: ${text}`)
  }
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

export const grocy = {
  getRecipes: () =>
    apiFetch<Recipe[]>('/objects/recipes').then((all) => all.filter((r) => r.type === 'normal')),

  getRecipe: (id: number) => apiFetch<Recipe>(`/objects/recipes/${id}`),

  getRecipeIngredients: (recipeId: number) => {
    const params = new URLSearchParams()
    params.append('query[]', `recipe_id=${recipeId}`)
    return apiFetch<RecipeIngredient[]>(`/objects/recipes_pos?${params.toString()}`)
  },

  getProducts: () => apiFetch<Product[]>('/objects/products'),

  getProduct: (id: number) => apiFetch<Product>(`/objects/products/${id}`),

  getQuantityUnits: () => apiFetch<QuantityUnit[]>('/objects/quantity_units'),

  createRecipe: (data: Partial<Recipe>) =>
    apiFetch<{ created_object_id: number }>('/objects/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateRecipe: (id: number, data: Partial<Recipe>) =>
    apiFetch<void>(`/objects/recipes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  deleteRecipe: (id: number) =>
    apiFetch<void>(`/objects/recipes/${id}`, { method: 'DELETE' }),

  deleteMealPlanEntry: (id: number) =>
    apiFetch<void>(`/objects/meal_plan/${id}`, { method: 'DELETE' }),

  getMealPlan: () => apiFetch<MealPlanEntry[]>('/objects/meal_plan'),

  logMeal: (entry: Omit<MealPlanEntry, 'id'>) =>
    apiFetch<{ created_object_id: number }>('/objects/meal_plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }),

  async uploadPicture(file: File): Promise<string> {
    const webp = await convertToWebP(file, 0.85)
    const filename = `meal_${Date.now()}.webp`
    const b64 = btoa(filename).replace(/=+$/, '')
    const res = await fetch(`/api/files/recipepictures/${b64}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: webp,
    })
    if (!res.ok) throw new Error(`Photo upload failed: ${res.status}`)
    return b64
  },

  async uploadProductPicture(file: File, productId: number): Promise<string> {
    const webp = await convertToWebP(file, 0.85)
    const filename = `product_${productId}_${Date.now()}.webp`
    const b64 = btoa(filename).replace(/=+$/, '')
    const res = await fetch(`/api/files/productpictures/${b64}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: webp,
    })
    if (!res.ok) throw new Error(`Product photo upload failed: ${res.status}`)
    return filename
  },

  pictureUrl: (b64name: string) => `/api/files/recipepictures/${b64name}`,

  productPictureUrl: (filename: string) => {
    const b64 = btoa(filename).replace(/=+$/, '')
    return `/api/files/productpictures/${b64}`
  },

  isWebP(b64name: string): boolean {
    const padded = b64name + '='.repeat((4 - b64name.length % 4) % 4)
    try { return atob(padded).endsWith('.webp') } catch { return false }
  },

  createProduct: (data: Record<string, unknown>) =>
    apiFetch<{ created_object_id: number }>('/objects/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateProduct: (id: number, data: Record<string, unknown>) =>
    apiFetch<void>(`/objects/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getStock: () => apiFetch<StockItem[]>('/stock'),

  async getProductStockAmount(productId: number): Promise<{ amount: number; value: number }> {
    const item = (await this.getStock()).find((s) => s.product_id === productId)
    if (item) return { amount: item.amount, value: item.value }
    const detail = await apiFetch<{ stock_amount: number; stock_value: number }>(
      `/stock/products/${productId}`
    )
    return { amount: detail.stock_amount ?? 0, value: detail.stock_value ?? 0 }
  },

  /** Despensa products, including those with zero stock (omitted from GET /stock). */
  async getDespensaStock(): Promise<StockItem[]> {
    const groupId = grocyConfig.despensaGroupId
    const [products, stock] = await Promise.all([
      this.getProducts(),
      this.getStock(),
    ])
    const despensaProducts = products.filter((p) => p.product_group_id === groupId)
    const stockByProductId = new Map(stock.map((s) => [s.product_id, s]))
    return despensaProducts.map((product) => {
      const existing = stockByProductId.get(product.id)
      if (existing) return existing
      return { product_id: product.id, amount: 0, value: 0, product }
    })
  },

  addStock: (id: number, amount: number, opts?: AddStockOptions) => {
    const body: Record<string, unknown> = { amount, transaction_type: 'purchase' }
    if (opts?.price != null) body.price = opts.price
    if (opts?.purchased_date) body.purchased_date = opts.purchased_date
    if (opts?.note) body.note = opts.note
    if (opts?.shopping_location_id != null) body.shopping_location_id = opts.shopping_location_id
    return apiFetch<void>(`/stock/products/${id}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },

  getPriceHistory: (productId: number) =>
    apiFetch<PriceHistoryPoint[]>(`/stock/products/${productId}/price-history`).then((rows) =>
      rows.map((r) => ({
        ...r,
        price: typeof r.price === 'string' ? parseFloat(r.price) : r.price,
      }))
    ),

  consumeStock: (id: number, amount: number) =>
    apiFetch<void>(`/stock/products/${id}/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, transaction_type: 'consume', spoiled: false }),
    }),

  getStockLog: (productId: number) => {
    const params = new URLSearchParams()
    params.append('query[]', `product_id=${productId}`)
    return apiFetch<StockLogEntry[]>(`/objects/stock_log?${params.toString()}`)
  },

  undoStockTransaction: (transactionId: string) =>
    apiFetch<void>(`/stock/transactions/${transactionId}/undo`, { method: 'POST' }),

  getAllStockLog: () => apiFetch<StockLogEntry[]>('/objects/stock_log'),

  getShoppingList: () => apiFetch<ShoppingListItem[]>('/objects/shopping_list'),

  addToShoppingList: (productId: number, amount: number) =>
    apiFetch<{ created_object_id: number }>('/objects/shopping_list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, amount }),
    }),

  removeFromShoppingList: (id: number) =>
    apiFetch<void>(`/objects/shopping_list/${id}`, { method: 'DELETE' }),

  markShoppingListDone: (item: ShoppingListItem) =>
    apiFetch<void>(`/objects/shopping_list/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, done: 1 }),
    }),

  async migratePhotosToWebP(
    recipes: Recipe[],
    onProgress: (done: number, total: number) => void
  ): Promise<void> {
    const legacy = recipes.filter((r) => r.picture_file_name && !this.isWebP(r.picture_file_name))
    for (let i = 0; i < legacy.length; i++) {
      const recipe = legacy[i]
      const oldB64 = recipe.picture_file_name!
      const imgRes = await fetch(this.pictureUrl(oldB64))
      if (!imgRes.ok) { onProgress(i + 1, legacy.length); continue }
      const blob = await imgRes.blob()
      const file = new File([blob], 'photo', { type: blob.type })
      const newB64 = await this.uploadPicture(file)
      await this.updateRecipe(recipe.id, { picture_file_name: newB64 })
      onProgress(i + 1, legacy.length)
    }
  },
}
