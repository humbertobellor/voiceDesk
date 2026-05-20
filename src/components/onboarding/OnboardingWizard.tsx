'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { AgentConfigStep } from './steps/AgentConfigStep'
import { CalendarConnectStep } from './steps/CalendarConnectStep'
import { PhoneProvisioningStep } from './steps/PhoneProvisioningStep'
import { CallForwardingStep } from './steps/CallForwardingStep'
import { TestCallStep } from './steps/TestCallStep'

interface Step {
  id: string
  label: string
}

const STEPS: Step[] = [
  { id: 'agent', label: 'Agent Config' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'phone', label: 'Phone' },
  { id: 'forwarding', label: 'Forwarding' },
  { id: 'test', label: 'Go Live' }
]

interface OnboardingWizardProps {
  contractorId: string
  voiceDeskNumber?: string | null
  onComplete?: () => void
}

export function OnboardingWizard({ contractorId, voiceDeskNumber, onComplete }: OnboardingWizardProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [testCallVerified, setTestCallVerified] = useState(false)

  // FIXED: canComplete check requires test call verification on the final step
  const canComplete = currentStep === STEPS.length - 1 ? testCallVerified : true

  const canProceed = (stepIndex: number) => {
    // Can always go back, can go forward if current step is completed
    return completedSteps.has(stepIndex) || stepIndex === currentStep
  }

  const handleNext = () => {
    setCompletedSteps(prev => new Set(prev).add(currentStep))
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    setCompletedSteps(prev => new Set(prev).add(currentStep))
    setIsOpen(false)
    onComplete?.()
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <AgentConfigStep contractorId={contractorId} onComplete={() => setCompletedSteps(prev => new Set(prev).add(0))} />
      case 1:
        return <CalendarConnectStep contractorId={contractorId} onComplete={() => setCompletedSteps(prev => new Set(prev).add(1))} />
      case 2:
        return <PhoneProvisioningStep contractorId={contractorId} onComplete={() => setCompletedSteps(prev => new Set(prev).add(2))} />
      case 3:
        return <CallForwardingStep contractorId={contractorId} voiceDeskNumber={voiceDeskNumber ?? undefined} onComplete={() => setCompletedSteps(prev => new Set(prev).add(3))} />
      case 4:
        return <TestCallStep contractorId={contractorId} voiceDeskNumber={voiceDeskNumber ?? undefined} onComplete={handleComplete} onVerified={() => setTestCallVerified(true)} />
      default:
        return null
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <Dialog.Title className="text-xl font-semibold text-white">
              Setup Your VoiceDesk
            </Dialog.Title>
            <Dialog.Close className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Tab Bar - All steps visible at once (D-06) */}
          <div className="flex border-b border-gray-700 px-6 overflow-x-auto">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => {
                  // Enforce linear order - can go back but not skip ahead (T-07-03-01)
                  if (index <= currentStep || completedSteps.has(index)) {
                    setCurrentStep(index)
                  }
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  currentStep === index
                    ? 'border-blue-500 text-blue-400'
                    : completedSteps.has(index)
                    ? 'border-green-500 text-green-400'
                    : index > currentStep && !completedSteps.has(index)
                    ? 'border-transparent text-gray-500 cursor-not-allowed'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {completedSteps.has(index) && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
                {step.label}
              </button>
            ))}
          </div>

          {/* Step Content */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            {renderStep()}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800/50">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep === STEPS.length - 1 ? (
              <button
                onClick={handleComplete}
                disabled={!canComplete}
                className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                  canComplete
                    ? 'text-white bg-green-600 hover:bg-green-700'
                    : 'text-gray-400 bg-gray-600 cursor-not-allowed'
                }`}
              >
                Complete Setup
                <Check className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}