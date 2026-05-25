import type { MealPlanEntry, Product, QuantityUnit, Recipe, RecipeIngredient } from '../types/grocy'

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
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `meal_${Date.now()}.${ext}`
    const b64 = btoa(filename).replace(/=+$/, '')
    const res = await fetch(`/api/files/recipepictures/${b64}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!res.ok) throw new Error(`Photo upload failed: ${res.status}`)
    return b64
  },

  pictureUrl: (b64name: string) => `/api/files/recipepictures/${b64name}`,
}
