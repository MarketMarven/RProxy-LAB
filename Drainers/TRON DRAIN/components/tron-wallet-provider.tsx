'use client'

import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks'
import { 
  TronLinkAdapter,
  TokenPocketAdapter,
  ImTokenAdapter,
  WalletConnectAdapter
} from '@tronweb3/tronwallet-adapters'
import { useMemo, type ReactNode } from 'react'
import { WalletError } from '@tronweb3/tronwallet-abstract-adapter'
import { toast } from 'sonner'

interface TronWalletProviderProps {
  children: ReactNode
}

export function TronWalletProvider({ children }: TronWalletProviderProps) {
  const adapters = useMemo(() => {
    if (typeof window === 'undefined') {
      return []
    }

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    
    const adaptersList = [
      new TronLinkAdapter(),
      new TokenPocketAdapter(),
      new ImTokenAdapter(),
    ]

    if (projectId) {
      adaptersList.push(
        new WalletConnectAdapter({
          network: 'Mainnet',
          options: {
            projectId,
            metadata: {
              name: 'TRON Wallet dApp',
              description: 'Connect your wallet to TRON',
              url: typeof window !== 'undefined' ? window.location.origin : '',
              icons: ['https://avatars.githubusercontent.com/u/37784886']
            }
          }
        })
      )
    }
    
    return adaptersList
  }, [])

  function onError(error: WalletError) {
    toast.error(error.message || 'Wallet error occurred')
  }

  return (
    <WalletProvider 
      adapters={adapters}
      onError={onError}
      autoConnect={false}
      disableAutoConnectOnLoad={true}
    >
      {children}
    </WalletProvider>
  )
}
