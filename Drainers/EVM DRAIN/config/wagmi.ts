import { cookieStorage, createStorage } from "@wagmi/core"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import {
  arbitrum,
  polygon,
  base,
} from "@reown/appkit/networks"

// Get projectId from https://cloud.reown.com
export const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""

if (!projectId) {
  console.warn('WalletConnect Project ID not found - deeplinks may not work')
}

// Only Polygon, Base и Arbitrum
export const networks = [polygon, base, arbitrum] as const

// Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
})

export const config = wagmiAdapter.wagmiConfig
