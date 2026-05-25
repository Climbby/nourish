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
  product_group_id: number | null
  qu_id_stock: number
  qu_id_purchase: number
  picture_file_name: string | null
  calories: number | null
}

export interface StockItem {
  product_id: number
  amount: number
  value: number
  product: Product
}

export interface StockLogEntry {
  id: number
  product_id: number
  amount: number
  transaction_type: string
  row_created_timestamp: string
}

export interface ShoppingListItem {
  id: number
  product_id: number
  amount: number
  note: string | null
  done: number
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
  row_created_timestamp?: string
}
