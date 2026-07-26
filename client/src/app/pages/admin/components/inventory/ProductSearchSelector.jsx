import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Search, X } from 'lucide-react'
import { formatCurrency } from '../../../../utils/formatCurrency'

export function ProductSearchSelector({ products, value, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  const productList = useMemo(() => {
    if (!products) return []
    return Array.isArray(products) ? products : []
  }, [products])

  const filteredProducts = useMemo(() => {
    if (productList.length === 0) return []
    if (!searchQuery) return productList.slice(0, 10)
    const q = searchQuery.toLowerCase()
    return productList
      .filter((p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 10)
  }, [productList, searchQuery])

  const selectedProduct = useMemo(() => {
    if (!value || productList.length === 0) return null
    return productList.find((p) => p.product_id === value)
  }, [productList, value])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchQuery])

  const handleSelect = (product) => {
    onChange(product.product_id, product)
    setSearchQuery('')
    setIsOpen(false)
  }

  const handleClear = (event) => {
    event.stopPropagation()
    onChange('', null)
    setSearchQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (!isOpen && (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ')) {
      event.preventDefault()
      setIsOpen(true)
      return
    }

    if (!isOpen) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlightedIndex((index) => Math.min(index + 1, filteredProducts.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setHighlightedIndex((index) => Math.max(index - 1, 0))
        break
      case 'Enter':
        event.preventDefault()
        if (filteredProducts[highlightedIndex]) {
          handleSelect(filteredProducts[highlightedIndex])
        }
        break
      case 'Escape':
        event.preventDefault()
        setIsOpen(false)
        break
      default:
        break
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery || (selectedProduct?.name || '')}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50"
        />
        {selectedProduct ? (
          <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isOpen && filteredProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-[100] w-full mt-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl shadow-xl max-h-64 overflow-y-auto"
        >
          {filteredProducts.map((product, index) => (
            <button
              key={product.product_id}
              type="button"
              onClick={() => handleSelect(product)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between border-b border-[var(--border)]/50 last:border-b-0 ${index === highlightedIndex ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/5'}`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-white font-medium truncate">{product.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{product.sku}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[var(--gold-primary)] font-mono text-sm">{formatCurrency(product.price)}</p>
                <p className={`text-xs ${product.stock > 10 ? 'text-green-400' : product.stock > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {product.stock} in stock
                </p>
              </div>
            </button>
          ))}
        </motion.div>
      )}

      {isOpen && filteredProducts.length === 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl shadow-xl p-4 text-center">
          <p className="text-[var(--text-muted)]">No products found</p>
        </div>
      )}
    </div>
  )
}

export default ProductSearchSelector
