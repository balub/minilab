import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Configurator } from './Configurator'
import type { ModelCatalog } from './domain/catalog'

vi.mock('./scene/ConfiguratorScene', () => ({
  ConfiguratorScene: ({ placements }: { placements: unknown[] }) => (
    <div data-testid="scene">3D scene with {placements.length} modules</div>
  ),
}))

const catalog: ModelCatalog = {
  generatedAt: '2026-08-30T00:00:00.000Z',
  rack: {
    id: 'minilab-4u',
    name: 'MiniLab 4U',
    heightU: 4,
    unitMm: 44.45,
    widthMm: 500,
    depthMm: 400,
    extrusionMm: 20,
  },
  modules: [
    {
      id: 'blank',
      name: '1U Blank',
      source: '1U Blank LaserCut.step',
      role: 'module',
      heightU: 1,
      manufacturingMethod: 'laser-cut',
      model: null,
      status: 'not-converted',
      mount: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], reference: 'front-center-bottom' },
      preview: { widthMm: 440, depthMm: 24, color: '#30343a' },
    },
    {
      id: 'tray',
      name: 'Equipment Tray',
      source: 'Tray.step',
      role: 'module',
      heightU: null,
      model: null,
      status: 'needs-review',
      mount: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], reference: 'front-center-bottom' },
    },
  ],
}

describe('Configurator', () => {
  it('adds a reviewed module and disables unreviewed modules', async () => {
    const user = userEvent.setup()
    render(<Configurator catalog={catalog} />)

    expect(screen.getByRole('button', { name: /add equipment tray/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /add 1u blank/i }))

    expect(await screen.findByTestId('scene')).toHaveTextContent('1 modules')
    expect(screen.getByRole('button', { name: /u1.*1u blank/i })).toBeInTheDocument()
    expect(screen.getByText('1 of 4U occupied')).toBeInTheDocument()
  })

  it('moves a selected module to an available U position and removes it', async () => {
    const user = userEvent.setup()
    render(<Configurator catalog={catalog} />)
    await user.click(screen.getByRole('button', { name: /add 1u blank/i }))
    await user.click(screen.getByRole('button', { name: /u1.*1u blank/i }))
    await user.click(screen.getByRole('button', { name: /u3.*available/i }))

    expect(screen.getByRole('button', { name: /u3.*1u blank/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remove 1u blank/i }))
    expect(screen.getByText('0 of 4U occupied')).toBeInTheDocument()
  })

  it('resets the full configuration', async () => {
    const user = userEvent.setup()
    render(<Configurator catalog={catalog} />)
    await user.click(screen.getByRole('button', { name: /add 1u blank/i }))
    await user.click(screen.getByRole('button', { name: /reset configuration/i }))
    expect(screen.getByText('0 of 4U occupied')).toBeInTheDocument()
  })
})
