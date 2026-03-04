'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ProjectIdCheck() {
  const [hasProjectId, setHasProjectId] = useState(true)
  const [projectIdPreview, setProjectIdPreview] = useState('')

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    
    if (projectId) {
      setProjectIdPreview(projectId.slice(0, 15) + '...')
      setHasProjectId(true)
    } else {
      setHasProjectId(false)
    }
  }, [])

  if (hasProjectId) {
    return (
      <div className="fixed top-4 right-4 z-[9999] max-w-sm">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-500 p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <div className="size-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
              ✓
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-900 dark:text-green-300">
                ProjectId OK
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 font-mono mt-1">
                {projectIdPreview}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm">
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-500 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-6 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">
              ProjectId missing!
            </p>
            <div className="space-y-2 text-xs text-red-800 dark:text-red-400">
              <p>WalletConnect cannot work without projectId.</p>
              <p className="font-bold">Steps:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open project settings in Vercel</li>
                <li>Add environment variable:</li>
                <li className="font-mono bg-red-100 dark:bg-red-900/40 p-2 rounded mt-1">
                  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
                </li>
                <li>Get projectId from cloud.walletconnect.com</li>
                <li>Redeploy project</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
