'use client'

import { useState, useEffect } from 'react'
import { useContractorSettings, useUpdateContractorSettings, useSyncRetellAgent } from '@/lib/query/client'
import type { Language, TradeType } from '@/types/database'

const TRADE_OPTIONS: { value: TradeType; label: string }[] = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'multi', label: 'Multi-Trade' }
]

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' }
]

export function BusinessInfoForm() {
  const { data: settings, isLoading } = useContractorSettings()
  const updateSettings = useUpdateContractorSettings()
  const syncRetell = useSyncRetellAgent()

  const [formData, setFormData] = useState({
    business_name: '',
    trade_type: 'hvac' as TradeType,
    service_area: '',
    supported_languages: ['en'] as Language[],
    after_hours_message: ''
  })

  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        trade_type: settings.trade_type || 'hvac',
        service_area: settings.service_area || '',
        supported_languages: settings.supported_languages || ['en'],
        after_hours_message: settings.after_hours_message || ''
      })
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateSettings.mutateAsync(formData)
      // Trigger Retell sync (fire and forget)
      syncRetell.mutate()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Business Name
        </label>
        <input
          type="text"
          value={formData.business_name}
          onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          placeholder="ABC Plumbing"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Trade Type
        </label>
        <select
          value={formData.trade_type}
          onChange={(e) => setFormData({ ...formData, trade_type: e.target.value as TradeType })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        >
          {TRADE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Service Area
        </label>
        <textarea
          value={formData.service_area}
          onChange={(e) => setFormData({ ...formData, service_area: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          rows={3}
          placeholder="Miami-Dade County, Broward County"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Supported Languages
        </label>
        <div className="flex gap-4">
          {LANGUAGE_OPTIONS.map((lang) => (
            <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.supported_languages.includes(lang.value)}
                onChange={(e) => {
                  const newLangs = e.target.checked
                    ? [...formData.supported_languages, lang.value]
                    : formData.supported_languages.filter((l) => l !== lang.value)
                  setFormData({ ...formData, supported_languages: newLangs })
                }}
                className="w-4 h-4 rounded bg-gray-800 border-gray-600"
              />
              <span className="text-white">{lang.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          After Hours Message
        </label>
        <textarea
          value={formData.after_hours_message}
          onChange={(e) => setFormData({ ...formData, after_hours_message: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          rows={3}
          placeholder="Thank you for calling. We're currently closed. Leave a message and we'll return your call during business hours."
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>

        {showSuccess && (
          <span className="text-green-400 text-sm">Saved! Retell sync triggered.</span>
        )}
      </div>
    </form>
  )
}