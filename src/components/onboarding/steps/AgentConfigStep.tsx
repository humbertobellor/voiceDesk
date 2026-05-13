'use client'

import { useState } from 'react'
import { Building2, Languages, Volume2, MapPin, Check } from 'lucide-react'

interface AgentConfigStepProps {
  contractorId: string
  onComplete?: () => void
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'ht', label: 'Haitian Creole' }
]

const VOICES = [
  { id: 'jennifer', label: 'Jennifer (Female, Professional)' },
  { id: 'matthew', label: 'Matthew (Male, Friendly)' },
  { id: 'sarah', label: 'Sarah (Female, Warm)' }
]

export function AgentConfigStep({ contractorId, onComplete }: AgentConfigStepProps) {
  const [formData, setFormData] = useState({
    business_name: '',
    supported_languages: ['en', 'es'] as string[],
    agent_voice: 'jennumberto',
    service_area: ''
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/contractor/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId,
          ...formData
        })
      })

      if (response.ok) {
        setSaved(true)
        onComplete?.()
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleLanguage = (code: string) => {
    setFormData(prev => ({
      ...prev,
      supported_languages: prev.supported_languages.includes(code)
        ? prev.supported_languages.filter(l => l !== code)
        : [...prev.supported_languages, code]
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Agent Configuration</h3>
        <p className="text-sm text-gray-400">Configure how your AI receptionist will represent your business.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Business Name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Building2 className="w-4 h-4 text-gray-400" />
            Business Name
          </label>
          <input
            type="text"
            value={formData.business_name}
            onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
            placeholder="Your Business Name"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Supported Languages */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Languages className="w-4 h-4 text-gray-400" />
            Supported Languages
          </label>
          <div className="flex gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.supported_languages.includes(lang.code)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Voice */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Volume2 className="w-4 h-4 text-gray-400" />
            Agent Voice
          </label>
          <select
            value={formData.agent_voice}
            onChange={(e) => setFormData(prev => ({ ...prev, agent_voice: e.target.value }))}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            {VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>{voice.label}</option>
            ))}
          </select>
        </div>

        {/* Service Area */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <MapPin className="w-4 h-4 text-gray-400" />
            Service Area
          </label>
          <input
            type="text"
            value={formData.service_area}
            onChange={(e) => setFormData(prev => ({ ...prev, service_area: e.target.value }))}
            placeholder="e.g., Miami-Dade County, FL"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-400">
              <Check className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}