import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Save, ShoppingCart, RotateCcw } from 'lucide-react'
import { GuitarPreview } from '../components/customize/GuitarPreview.jsx'
import { CustomizationPanel } from '../components/customize/CustomizationPanel.jsx'
import { PricePanel } from '../components/customize/PricePanel.jsx'

const defaultConfig = {
  type: 'electric',
  bodyShape: 'stratocaster',
  colorMode: 'single',
  primaryColor: '#1a1a1a',
  secondaryColor: '#d4af37',
  tertiaryColor: '#ffffff',
  hardware: {
    pickups: 'humbucker',
    bridge: 'tremolo',
    tuners: 'locking',
    knobs: 'chrome',
  },
  decals: [],
}

export function CustomizePage() {
  const [config, setConfig] = useState(defaultConfig)
  const [basePrice] = useState(1200)
  const [totalPrice, setTotalPrice] = useState(basePrice)
  const [estimatedDays] = useState(45)

  useEffect(() => {
    let price = basePrice
    if (config.colorMode === 'two-tone') price += 150
    if (config.colorMode === 'three-tone') price += 300
    if (config.hardware.pickups === 'active') price += 200
    if (config.hardware.bridge === 'floyd-rose') price += 250
    price += config.decals.length * 50
    setTotalPrice(price)
  }, [config, basePrice])

  const handleReset = () => {
    setConfig(defaultConfig)
  }

  const handleSave = () => {
    localStorage.setItem('savedGuitarDesign', JSON.stringify(config))
    alert('Design saved! Login to access your saved designs.')
  }

  const handleAddToCart = () => {
    alert('Please login to add items to cart')
  }

  return (
    <div className="min-h-screen pt-16 bg-[#f5f5f7]">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Guitar Customizer</h1>
          <p className="text-sm text-gray-500">Design your perfect instrument with real-time preview</p>
        </div>

        <div className="grid lg:grid-cols-[350px_1fr_320px] gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:sticky lg:top-24 h-fit"
          >
            <CustomizationPanel config={config} setConfig={setConfig} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white border border-gray-200 rounded-2xl p-8 min-h-[600px] flex items-center justify-center shadow-sm"
          >
            <GuitarPreview config={config} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:sticky lg:top-24 h-fit space-y-4"
          >
            <PricePanel totalPrice={totalPrice} estimatedDays={estimatedDays} />

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3 shadow-sm">
              <button
                onClick={handleSave}
                className="w-full px-4 py-3 bg-gray-100 text-gray-900 rounded-lg text-sm font-semibold hover:bg-[#fff7dd] hover:text-[#231f20] border border-gray-200 hover:border-[#d4af37] transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Design
              </button>
              <button
                onClick={handleAddToCart}
                className="w-full px-4 py-3 bg-[#d4af37] text-[#231f20] rounded-lg text-sm font-semibold hover:bg-[#c39d2f] transition-all duration-200 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>
              <button
                onClick={handleReset}
                className="w-full px-4 py-3 bg-white text-gray-500 rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 border border-gray-200 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Reset
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
