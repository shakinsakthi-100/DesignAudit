import { useState, useEffect } from 'react'

interface ChatbotSymbolProps {
  onClick: () => void
  tooltipText?: string
}

export default function ChatbotSymbol({ onClick, tooltipText = '🔍 Click here to start visual design audit!' }: ChatbotSymbolProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    // Show tooltip after a 1.5s delay to attract attention
    const timer = setTimeout(() => {
      setShowTooltip(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="chatbot-fab-container">
      {showTooltip && (
        <div className="chatbot-tooltip">
          {tooltipText}
        </div>
      )}
      <button className="chatbot-fab" onClick={onClick} aria-label="Open Design Audit">
        <div className="chatbot-pulse-ring"></div>
        🤖
      </button>
    </div>
  )
}
