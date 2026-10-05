import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { ChevronUp, Layers, ReceiptText, X } from 'lucide-react'
import { formatPeso } from '../../utils/buildConfigurationLineItems.js'
import '../../../styles/BuilderResponsive.css'

export function BuilderConfiguratorDrawer({ optionsPanel, summaryPanel, price, loadingPrices }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('parts')

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="builder-drawer-launcher">
        <Dialog.Trigger asChild>
          <button type="button" className="builder-drawer-trigger">
            <span className="builder-drawer-label">
              <Layers className="h-5 w-5 shrink-0" />
              <span>Parts &amp; Price</span>
            </span>
            <span className="builder-drawer-price">
              <span className="tabular-nums">{loadingPrices ? 'Loading…' : formatPeso(price)}</span>
              <ChevronUp className="h-5 w-5 shrink-0" />
            </span>
          </button>
        </Dialog.Trigger>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="builder-drawer-overlay" />
        <Dialog.Content
          className="builder-drawer"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            }
          }}
        >
          <div className="builder-drawer-heading">
            <div className="min-w-0">
              <Dialog.Title className="font-semibold">Configure your build</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--text-muted)]">
                Choose your parts and review the price breakdown.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="builder-drawer-close" aria-label="Close configurator">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <Tabs.Root value={tab} onValueChange={setTab} className="builder-drawer-panes">
            <Tabs.List aria-label="Configurator panels" className="builder-drawer-tab-list">
              <Tabs.Trigger value="parts" className="builder-drawer-tab">
                <Layers className="h-4 w-4 shrink-0" /> Parts
              </Tabs.Trigger>
              <Tabs.Trigger value="price" className="builder-drawer-tab">
                <ReceiptText className="h-4 w-4 shrink-0" /> Price breakdown
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="parts" className="builder-drawer-content">{optionsPanel}</Tabs.Content>
            <Tabs.Content value="price" className="builder-drawer-content">{summaryPanel}</Tabs.Content>
          </Tabs.Root>
          <div className="builder-drawer-total-bar">
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Your Build Total</p>
              <p className="text-xl font-bold tabular-nums text-[var(--gold-primary)]">
                {loadingPrices ? 'Loading…' : formatPeso(price)}
              </p>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="builder-drawer-done">Done</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
