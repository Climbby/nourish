export const MEAL_LIST_PAGE_SIZE = 18

export function hasRecipePhoto(item: { picture_file_name?: string | null }): boolean {
  return Boolean(item.picture_file_name)
}

/** Keep existing order, but send items without a photo to the end. */
export function sortPhotosFirst<T extends { picture_file_name?: string | null }>(items: T[]): T[] {
  const withPhoto: T[] = []
  const withoutPhoto: T[] = []
  for (const item of items) {
    if (hasRecipePhoto(item)) withPhoto.push(item)
    else withoutPhoto.push(item)
  }
  return [...withPhoto, ...withoutPhoto]
}

export function windowItems<T>(items: T[], visibleCount: number): T[] {
  if (visibleCount <= 0) return []
  return items.slice(0, visibleCount)
}

export function splitByPhoto<T extends { picture_file_name?: string | null }>(
  items: T[]
): { withPhoto: T[]; withoutPhoto: T[] } {
  const withPhoto: T[] = []
  const withoutPhoto: T[] = []
  for (const item of items) {
    if (hasRecipePhoto(item)) withPhoto.push(item)
    else withoutPhoto.push(item)
  }
  return { withPhoto, withoutPhoto }
}
