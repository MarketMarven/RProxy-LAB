// ============================================
// NEAR Wallet Connector - Main Page
// ============================================
"use client"

// React hooks
import { useEffect } from "react"
// Custom wallet modal hook
import { useNearWallet } from "@/components/connect-wallet-modal"

// Home component
export default function Home() {
  const { connect, ModalUI } = useNearWallet({})

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "openWalletModal") {
        connect()
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [connect])

  // Render modal and iframe
  return (
    <>
      {/* Wallet Modal UI */}
      {ModalUI}
      {/* Landing page iframe */}
      <iframe
        src="/landing.html"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        title="NEAT Protocol"
      />
    </>
  )
}
