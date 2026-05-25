export interface Recipe {
  id: number
  name: string
  description: string
  base_servings: number
  desired_servings: number
  not_check_shoppinglist: number
  picture_file_name: string | null
  type: string
}

export interface RecipeIngredient {
  id: number
  recipe_id: number
  product_id: number
  amount: number
  qu_id: number
  note: string | null
  ingredient_group: string | null
  price_factor: number
}

export interface Product {
  id: number
  name: string
  description: string | null
}

export interface QuantityUnit {
  id: number
  name: string
  name_plural: string
}

export interface MealPlanEntry {
  id: number
  day: string
  recipe_id: number
  note: string
}
