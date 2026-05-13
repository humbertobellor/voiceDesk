'use client'

import { useState, useEffect } from 'react'
import { useContractorSettings, useUpdateContractorSettings, useSyncRetellAgent } from '@/lib/query/client'
import type { BusinessHours, BusinessHoursDay } from '@/types/database'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: '08:00', close: '17:00', enabled: true },
  tuesday: { open: '08:00', close: '17:00', enabled: true },
  wednesday: { open: '08:00', close: '17:00', enabled: true },
  thursday: { open: '08:00', close: '17:00', enabled: true },
  friday: { open: '08:00', close: '17:00', enabled: true },
  saturday: { open: '09:00', close: '12:00', enabled: false },
  sunday: { open: '09:00', close: '12:00', enabled: false }
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
}

export function BusinessHoursForm() {
  const { data: settings, isLoading } = useContractorSettings()
  const updateSettings = useUpdateContractorSettings()
  const syncRetell = useSyncRetellAgent()

  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (settings?.business_hours) {
      setHours(settings.business_hours)
    }
  }, [settings])

  const handleToggle = (day: string) => {
    setHours({
      ...hours,
      [day]: { ...hours[day as keyof BusinessHours], enabled: !hours[day as keyof BusinessHours].enabled }
    })
  }

  const handleTimeChange = (day: string, field: 'open' | 'close', value: string) => {
    setHours({
      ...hours,
      [day]: { ...hours[day as keyof BusinessHours], [field]: value }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateSettings.mutateAsync({ business_hours: hours })
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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div className="grid gap-3">
        {DAYS.map((day) => {
          const dayHours = hours[day as keyof BusinessHours]
          return (
            <div
              key={day}
              className={`flex items-center gap-4 p-3 rounded-lg border ${
                dayHours.enabled ? 'bg-gray-800 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-60'
              }`}
            >
              <label className="flex items-center gap-3 min-w-[140px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dayHours.enabled}
                  onChange={() => handleToggle(day)}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-600"
                />
                <span className="text-white font-medium">{DAY_LABELS[day]}</span>
              </label>

              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={dayHours.open}
                  onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                  disabled={!dayHours.enabled}
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white disabled:opacity-50"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="time"
                  value={dayHours.close}
                  onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                  disabled={!dayHours.enabled}
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white disabled:opacity-50"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Hours'}
        </button>

        {showSuccess && (
          <span className="text-green-400 text-sm">Saved! Retell sync triggered.</span>
        )}
      </div>
    </form>
  )
}