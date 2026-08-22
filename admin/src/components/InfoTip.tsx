export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info">
      <span className="dot" aria-label={text} role="img">
        i
      </span>
      <span className="bubble">{text}</span>
    </span>
  )
}
