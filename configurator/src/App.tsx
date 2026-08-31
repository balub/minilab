import { useEffect, useState } from 'react'
import { Configurator } from './Configurator'
import type { ModelCatalog } from './domain/catalog'

export default function App() {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/models/catalog.json')
      .then((response) => {
        if (!response.ok) throw new Error(`catalog request failed (${response.status})`)
        return response.json() as Promise<ModelCatalog>
      })
      .then((data) => active && setCatalog(data))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'catalog request failed'))
    return () => { active = false }
  }, [])

  if (error) {
    return <main className="load-state"><strong>Model catalog unavailable</strong><span>{error}. Run <code>pnpm models</code> and reload.</span></main>
  }
  if (!catalog) return <main className="load-state"><span className="loader" /><strong>Loading MiniLab</strong></main>
  return <Configurator catalog={catalog} />
}
