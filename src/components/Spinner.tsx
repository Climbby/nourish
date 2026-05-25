export function Spinner() {
  return (
    <div className="flex justify-center items-center py-16" role="status" aria-label="A carregar...">
      <div className="w-8 h-8 border-2 border-nourish-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
