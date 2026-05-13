'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useContractorSettings, useUpdateContractorSettings, useSyncRetellAgent } from '@/lib/query/client'
import type { EmergencyKeywords } from '@/types/database'

const HARDCODED_EMERGENCIES = ['gas smell', 'co alarm', 'carbon monoxide']

export function KeywordsForm() {
  const { data: settings, isLoading } = useContractorSettings()
  const updateSettings = useUpdateContractorSettings()
  const syncRetell = useSyncRetellAgent()

  const [keywords, setKeywords] = useState<EmergencyKeywords>({ en: [], es: [] })
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (settings?.emergency_keywords) {
      setKeywords(settings.emergency_keywords)
    }
  }, [settings])

  const handleKeywordsChange = (lang: 'en' | 'es', value: string) => {
    const lines = value.split('\n').filter((line) => line.trim() !== '')
    setKeywords({ ...keywords, [lang]: lines })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateSettings.mutateAsync({ emergency_keywords: keywords })
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
      {/* Hardcoded emergencies notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-800 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-amber-400 font-medium mb-1">Hardcoded Emergency Triggers</p>
          <p className="text-gray-400">
            The following keywords are always enabled and cannot be disabled:
          </p>
          <p className="text-white mt-1 font-mono">{HARDCODED_EMERGENCIES.join(', ')}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          English Emergency Keywords
        </label>
        <textarea
          value={keywords.en.join('\n')}
          onChange={(e) => handleKeywordsChange('en', e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm"
          rows={5}
          placeholder="water leak&#10;no heat&#10;furnace not working"
        />
        <p className="text-xs text-gray-500 mt-1">Enter one keyword per line</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Spanish Emergency Keywords
        </label>
        <textarea
          value={keywords.es.join('\n')}
          onChange={(e) => handleKeywordsChange('es', e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm"
          rows={5}
          placeholder="fuga de agua&#10;sin calor&#10;horno no funciona"
        />
        <p className="text-xs text-gray-500 mt-1">Ingrese una palabra clave por línea</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Keywords'}
        </button>

        {showSuccess && (
          <span className="text-green-400 text-sm">Saved! Retell sync triggered.</span>
        )}
      </div>
    </form>
  )
}