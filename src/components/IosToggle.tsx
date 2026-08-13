/** iOS-style switch used in Profile settings and elsewhere. */
export function IosToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-[42px] h-[26px] flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-surface ${
        checked ? 'bg-nourish-primary' : 'bg-nourish-border'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full bg-white shadow transition-transform duration-200 ease-out ${
          checked ? 'translate-x-[16px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
