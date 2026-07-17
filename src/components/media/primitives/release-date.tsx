export function MediaYear({ date }: { date: Date | null }) {
  if (!date) return null
  return <span>{date.getFullYear()}</span>
}
