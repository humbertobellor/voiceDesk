'use client'

import { useState } from 'react'
import { Building2, Clock, Shield, Volume2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  icon: ReactNode
}

const TABS: Tab[] = [
  { id: 'business', label: 'Business Info', icon: <Building2 className="w-4 h-4" /> },
  { id: 'hours', label: 'Hours', icon: <Clock className="w-4 h-4" /> },
  { id: 'keywords', label: 'Keywords', icon: <Shield className="w-4 h-4" /> },
  { id: 'voice', label: 'Voice', icon: <Volume2 className="w-4 h-4" /> }
]

interface AgentConfigTabsProps {
  children: ReactNode
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function AgentConfigTabs({ children, activeTab, onTabChange }: AgentConfigTabsProps) {
  return (
    <div>
      {/* Tab List */}
      <div className="flex border-b border-gray-700 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  )
}

export { TABS }