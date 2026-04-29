"use client"

import { useState } from "react"
import { WalletModal } from "@/components/sui"

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
      >
        Connect Wallet
      </button>

      {/* */}
      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  )
}
