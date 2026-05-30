'use client'

import { useState } from 'react'
import { AgentConfigTabs } from '@/components/agent/AgentConfigTabs'
import { BusinessInfoForm } from '@/components/agent/BusinessInfoForm'
import { BusinessHoursForm } from '@/components/agent/BusinessHoursForm'
import { KeywordsForm } from '@/components/agent/KeywordsForm'
import { VoiceForm } from '@/components/agent/VoiceForm'

export default function AgentConfigPage() {
  const [activeTab, setActiveTab] = useState('business')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-on-dark mb-1">Agent Configuration</h1>
        <p className="text-sm text-fg-3">
          Configure your AI receptionist's business details, availability, emergency triggers, and voice.
        </p>
        <div className="border-b border-rule mt-6" />
      </div>

      <AgentConfigTabs activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'business' && <BusinessInfoForm />}
        {activeTab === 'hours' && <BusinessHoursForm />}
        {activeTab === 'keywords' && <KeywordsForm />}
        {activeTab === 'voice' && <VoiceForm />}
      </AgentConfigTabs>
    </div>
  )
}