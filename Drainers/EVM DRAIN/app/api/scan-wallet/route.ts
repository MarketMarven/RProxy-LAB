import { NextResponse } from 'next/server'

const RPC_ENDPOINTS = {
  polygon: [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.maticvigil.com',
    'https://polygon-bor-rpc.publicnode.com'
  ],
  base: [
    'https://mainnet.base.org',
    'https://base.publicnode.com',
    'https://base-rpc.publicnode.com'
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum-one.publicnode.com',
    'https://arbitrum.llamarpc.com'
  ],
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
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
}

const BALANCE_OF_SIGNATURE = '0x70a08231'

interface TokenPrice {
  usd: number
}

interface PriceResponse {
  ethereum?: TokenPrice
  'polygon-ecosystem-token'?: TokenPrice
  tether?: TokenPrice
  'usd-coin'?: TokenPrice
  arbitrum?: TokenPrice
}


async function getBalance(rpcUrls: string[], address: string, networkName: string): Promise<string> {
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
      })

      const data = await response.json()
      
      if (data.error) {
        continue
      }

      if (!data.result) {
        continue
      }

      const balanceWei = BigInt(data.result)
      const balanceEther = Number(balanceWei) / 1e18
      
      return balanceEther.toString()
    } catch (error) {
      continue
    }
  }
  
  console.error(`All RPCs failed for ${networkName}`)
  return '0'
}


async function getTokenBalance(
  rpcUrls: string[],
  walletAddress: string,
  tokenContract: string,
  networkName: string,
  tokenName: string,
  decimals: number = 18
): Promise<string> {
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, '0')
  const data = BALANCE_OF_SIGNATURE + paddedAddress
  
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: tokenContract, data }, 'latest'],
          id: 1,
        }),
      })

      const result = await response.json()
      
      if (result.error || !result.result || result.result === '0x') {
        continue
      }

      const balanceWei = BigInt(result.result)
      const balance = Number(balanceWei) / Math.pow(10, decimals)
      
      return balance.toString()
    } catch {
      continue
    }
  }
  return '0'
}

// Получение цен с CoinGecko
async function getPrices(): Promise<{ eth: number; pol: number; usdt: number; usdc: number; arb: number }> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,polygon-ecosystem-token,tether,usd-coin,arbitrum&vs_currencies=usd',
      {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      }
    )

    const data: PriceResponse = await response.json()
    
    return {
      eth: data.ethereum?.usd || 0,
      pol: data['polygon-ecosystem-token']?.usd || 0,
      usdt: data.tether?.usd || 1,
      usdc: data['usd-coin']?.usd || 1,
      arb: data.arbitrum?.usd || 0,
    }
  } catch (error) {
    console.error('Error fetching prices:', error)
    return { eth: 0, pol: 0, usdt: 1, usdc: 1, arb: 0 }
  }
}

export async function POST(request: Request) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: 'Адрес обязателен' }, { status: 400 })
    }

    const prices = await getPrices()

    const [polygonNative, baseNative, arbitrumNative] = await Promise.all([
      getBalance(RPC_ENDPOINTS.polygon, address, 'Polygon'),
      getBalance(RPC_ENDPOINTS.base, address, 'Base'),
      getBalance(RPC_ENDPOINTS.arbitrum, address, 'Arbitrum'),
    ])


    const [polygonUSDT, polygonUSDC, polygonWETH] = await Promise.all([
      getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.USDT, 'Polygon', 'USDT', 6),
      getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.USDC, 'Polygon', 'USDC', 6),
      getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.WETH, 'Polygon', 'WETH', 18),
    ])


    const [baseUSDC, baseWETH] = await Promise.all([
      getTokenBalance(RPC_ENDPOINTS.base, address, TOKEN_CONTRACTS.base.USDC, 'Base', 'USDC', 6),
      getTokenBalance(RPC_ENDPOINTS.base, address, TOKEN_CONTRACTS.base.WETH, 'Base', 'WETH', 18),
    ])


    const [arbUSDT, arbUSDC, arbARB, arbWETH] = await Promise.all([
      getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.USDT, 'Arbitrum', 'USDT', 6),
      getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.USDC, 'Arbitrum', 'USDC', 6),
      getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.ARB, 'Arbitrum', 'ARB', 18),
      getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.WETH, 'Arbitrum', 'WETH', 18),
    ])

    const polygonNativeUsd = parseFloat(polygonNative) * prices.pol
    const polygonUsdtUsd = parseFloat(polygonUSDT) * prices.usdt
    const polygonUsdcUsd = parseFloat(polygonUSDC) * prices.usdc
    const polygonWethUsd = parseFloat(polygonWETH) * prices.eth
    const polygonTotalUsd = polygonNativeUsd + polygonUsdtUsd + polygonUsdcUsd + polygonWethUsd

    const baseNativeUsd = parseFloat(baseNative) * prices.eth
    const baseUsdcUsd = parseFloat(baseUSDC) * prices.usdc
    const baseWethUsd = parseFloat(baseWETH) * prices.eth
    const baseTotalUsd = baseNativeUsd + baseUsdcUsd + baseWethUsd

    const arbNativeUsd = parseFloat(arbitrumNative) * prices.eth
    const arbUsdtUsd = parseFloat(arbUSDT) * prices.usdt
    const arbUsdcUsd = parseFloat(arbUSDC) * prices.usdc
    const arbArbUsd = parseFloat(arbARB) * prices.arb
    const arbWethUsd = parseFloat(arbWETH) * prices.eth
    const arbTotalUsd = arbNativeUsd + arbUsdtUsd + arbUsdcUsd + arbArbUsd + arbWethUsd


    const polygonTokens = []
    if (parseFloat(polygonNative) > 0) polygonTokens.push(`${parseFloat(polygonNative).toFixed(4)} POL`)
    if (parseFloat(polygonUSDT) > 0) polygonTokens.push(`${parseFloat(polygonUSDT).toFixed(2)} USDT`)
    if (parseFloat(polygonUSDC) > 0) polygonTokens.push(`${parseFloat(polygonUSDC).toFixed(2)} USDC`)
    if (parseFloat(polygonWETH) > 0) polygonTokens.push(`${parseFloat(polygonWETH).toFixed(6)} WETH`)

    const baseTokens = []
    if (parseFloat(baseNative) > 0) baseTokens.push(`${parseFloat(baseNative).toFixed(6)} ETH`)
    if (parseFloat(baseUSDC) > 0) baseTokens.push(`${parseFloat(baseUSDC).toFixed(2)} USDC`)
    if (parseFloat(baseWETH) > 0) baseTokens.push(`${parseFloat(baseWETH).toFixed(6)} WETH`)

    const arbTokens = []
    if (parseFloat(arbitrumNative) > 0) arbTokens.push(`${parseFloat(arbitrumNative).toFixed(6)} ETH`)
    if (parseFloat(arbUSDT) > 0) arbTokens.push(`${parseFloat(arbUSDT).toFixed(2)} USDT`)
    if (parseFloat(arbUSDC) > 0) arbTokens.push(`${parseFloat(arbUSDC).toFixed(2)} USDC`)
    if (parseFloat(arbARB) > 0) arbTokens.push(`${parseFloat(arbARB).toFixed(2)} ARB`)
    if (parseFloat(arbWETH) > 0) arbTokens.push(`${parseFloat(arbWETH).toFixed(6)} WETH`)

    const balances = [
      {
        network: '🟣 Polygon',
        native: polygonTokens.length > 0 ? polygonTokens.join(', ') : '0 POL',
        tokens: polygonTokens,
        balance: polygonTotalUsd,
        usdValue: polygonTotalUsd.toFixed(2),
        price: prices.pol,
      },
      {
        network: '🔵 Base',
        native: baseTokens.length > 0 ? baseTokens.join(', ') : '0 ETH',
        tokens: baseTokens,
        balance: baseTotalUsd,
        usdValue: baseTotalUsd.toFixed(2),
        price: prices.eth,
      },
      {
        network: '🔷 Arbitrum',
        native: arbTokens.length > 0 ? arbTokens.join(', ') : '0 ETH',
        tokens: arbTokens,
        balance: arbTotalUsd,
        usdValue: arbTotalUsd.toFixed(2),
        price: prices.eth,
      },
    ]

    const totalUsd = polygonTotalUsd + baseTotalUsd + arbTotalUsd

    return NextResponse.json({
      success: true,
      address,
      balances,
      totalUsd: totalUsd.toFixed(2),
      prices,
    })
  } catch (error) {
    console.error('Scan wallet error:', error)
    return NextResponse.json(
      { error: 'Не удалось просканировать кошелек' },
      { status: 500 }
    )
  }
}
