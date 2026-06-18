import { Component } from 'react'

// Catches render-time errors anywhere below it and shows a branded retry
// screen instead of a blank white page. Class component because error
// boundaries have no hook equivalent.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Surface for debugging; swap for a real reporter (Sentry) when wired up.
    console.error('Render error caught by ErrorBoundary:', error, info)
  }

  handleReload = () => {
    // Clear the error state and force a fresh render of the tree.
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-dvh bg-midnight flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="font-display text-[32px] text-clipper-red tracking-widest leading-none">
            STYLZZ
          </div>
          <div className="font-heading text-[13px] tracking-wider uppercase text-cream">
            Something glitched, King.
          </div>
          <div className="font-body text-[11px] text-warm-grey">
            That wasn't supposed to happen. Reload and you're back in the chair.
          </div>
          <button onClick={this.handleReload} className="btn btn-primary mt-2">
            RELOAD
          </button>
        </div>
      </div>
    )
  }
}
