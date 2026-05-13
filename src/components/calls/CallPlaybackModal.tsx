'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Play, Pause, Loader2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useCallById, useCallRecordingUrl } from '@/lib/query/client'

interface CallPlaybackModalProps {
  callId: string
  onClose: () => void
}

export function CallPlaybackModal({ callId, onClose }: CallPlaybackModalProps) {
  const { data: call, isLoading: callLoading } = useCallById(callId)
  const { data: signedUrl, isLoading: urlLoading, error: urlError } = useCallRecordingUrl(callId)

  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isLoading = callLoading || urlLoading

  useEffect(() => {
    const audio = new Audio(signedUrl ?? undefined)
    audio.addEventListener('ended', () => setIsPlaying(false))
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [signedUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const renderTranscript = () => {
    if (!call?.transcript) {
      return <p className="text-gray-400 italic">No transcript available</p>
    }

    // Handle both array format (from Retell) and string format
    if (Array.isArray(call.transcript)) {
      return (
        <div className="space-y-2">
          {call.transcript.map((item: unknown, idx: number) => {
            if (typeof item === 'object' && item !== null) {
              const t = item as { role?: string; content?: string }
              return (
                <div key={idx} className={`p-2 rounded ${t.role === 'agent' ? 'bg-blue-900/30 ml-8' : 'bg-gray-800 mr-8'}`}>
                  <span className="text-xs text-gray-500 uppercase">{t.role}</span>
                  <p className="text-white">{t.content}</p>
                </div>
              )
            }
            return (
              <div key={idx} className="p-2 bg-gray-800 rounded">
                <p className="text-white">{String(item)}</p>
              </div>
            )
          })}
        </div>
      )
    }

    // String format
    return <p className="text-white whitespace-pre-wrap">{String(call.transcript)}</p>
  }

  return (
    <Dialog.Root open={true} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-white">
              Call Details
            </Dialog.Title>
            <Dialog.Close className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : call ? (
              <>
                {/* Call Info */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-400">Caller</p>
                    <p className="text-white font-medium">{call.caller_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-white font-mono">{call.caller_phone || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Date & Time</p>
                    <p className="text-white">{formatDate(call.started_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Duration</p>
                    <p className="text-white">{formatDuration(call.duration_seconds)}</p>
                  </div>
                </div>

                {/* Audio Player */}
                {signedUrl ? (
                  <div className="mb-6">
                    <p className="text-sm text-gray-400 mb-2">Recording</p>
                    <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
                      <button
                        onClick={togglePlay}
                        className="flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white ml-1" />
                        )}
                      </button>
                      <audio
                        src={signedUrl}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                        controls
                      />
                      <div className="flex-1">
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-0 animate-pulse" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Click play to listen</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-4 bg-gray-800/50 rounded-lg text-center">
                    <p className="text-gray-400">Recording unavailable</p>
                  </div>
                )}

                {/* Summary */}
                {call.summary && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-400 mb-2">AI Summary</p>
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                      <p className="text-white">{call.summary}</p>
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Transcript</p>
                  <div className="p-4 bg-gray-800/50 rounded-lg max-h-64 overflow-y-auto">
                    {renderTranscript()}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Call not found
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}