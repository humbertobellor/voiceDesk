'use client'

import { useState, useEffect } from 'react'
import { Volume2, Play, Pause } from 'lucide-react'
import { useContractorSettings, useUpdateContractorSettings, useSyncRetellAgent } from '@/lib/query/client'

interface VoiceOption {
  id: string
  name: string
  gender: string
  description: string
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'sarah', name: 'Sarah', gender: 'Female', description: 'Warm and professional' },
  { id: 'james', name: 'James', gender: 'Male', description: 'Clear and authoritative' },
  { id: 'emily', name: 'Emily', gender: 'Female', description: 'Friendly and casual' },
  { id: 'michael', name: 'Michael', gender: 'Male', description: 'Deep and trustworthy' },
  { id: 'sophia', name: 'Sophia', gender: 'Female', description: 'Modern and confident' },
  { id: 'daniel', name: 'Daniel', gender: 'Male', description: 'Natural and engaging' }
]

export function VoiceForm() {
  const { data: settings, isLoading } = useContractorSettings()
  const updateSettings = useUpdateContractorSettings()
  const syncRetell = useSyncRetellAgent()

  const [selectedVoice, setSelectedVoice] = useState('sarah')
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (settings?.agent_voice) {
      setSelectedVoice(settings.agent_voice)
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateSettings.mutateAsync({ agent_voice: selectedVoice })
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {VOICE_OPTIONS.map((voice) => (
          <button
            key={voice.id}
            type="button"
            onClick={() => setSelectedVoice(voice.id)}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedVoice === voice.id
                ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white">{voice.name}</span>
              <span className="text-xs text-gray-400">{voice.gender}</span>
            </div>
            <p className="text-sm text-gray-400">{voice.description}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Voice'}
        </button>

        {showSuccess && (
          <span className="text-green-400 text-sm">Saved! Retell sync triggered.</span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Note: Preview functionality requires Retell API access. Voice selection updates the AI agent's voice immediately.
      </p>
    </form>
  )
}