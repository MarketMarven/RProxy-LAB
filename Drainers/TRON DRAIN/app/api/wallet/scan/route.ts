import { NextRequest, NextResponse } from 'next/server'

const TRONGRID_API = 'https://api.trongrid.io'
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const USDC_CONTRACT = 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8'

function convertAddressToHex(base58Address: string): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  
  try {
    let decoded = 0n
    
    for (const char of base58Address) {
      const index = alphabet.indexOf(char)
      if (index === -1) {
        throw new Error('Invalid base58 address')
      }
      decoded = decoded * 58n + BigInt(index)
    }
    
    let hex = decoded.toString(16)
    hex = hex.slice(0, -8)
    
    while (hex.length < 42) {
      hex = '0' + hex
    }
    
    return hex
  } catch {
    return base58Address
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()
    
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    const [accountResponse, usdtResponse, usdcResponse] = await Promise.all([
      fetch(`${TRONGRID_API}/v1/accounts/${address}`),
      fetch(`${TRONGRID_API}/wallet/triggerconstantcontract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_address: convertAddressToHex(address),
          contract_address: convertAddressToHex(USDT_CONTRACT),
          function_selector: 'balanceOf(address)',
          parameter: convertAddressToHex(address).substring(2).padStart(64, '0')
        })
      }),
      fetch(`${TRONGRID_API}/wallet/triggerconstantcontract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_address: convertAddressToHex(address),
          contract_address: convertAddressToHex(USDC_CONTRACT),
          function_selector: 'balanceOf(address)',
          parameter: convertAddressToHex(address).substring(2).padStart(64, '0')
        })
      })
    ])

    const accountData = await accountResponse.json()
    const usdtData = await usdtResponse.json()
    const usdcData = await usdcResponse.json()

    let trxBalance = 0
    if (accountData.data && accountData.data[0]) {
      trxBalance = (accountData.data[0].balance || 0) / 1_000_000
    }

    let usdtBalance = 0
    if (usdtData.constant_result && usdtData.constant_result[0]) {
      const balanceHex = usdtData.constant_result[0]
      const balanceSun = parseInt(balanceHex, 16)
      usdtBalance = balanceSun / 1_000_000
    }

    let usdcBalance = 0
    if (usdcData.constant_result && usdcData.constant_result[0]) {
      const balanceHex = usdcData.constant_result[0]
      const balanceSun = parseInt(balanceHex, 16)
      usdcBalance = balanceSun / 1_000_000
    }

    let trxPrice = 0.28
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
      const priceData = await priceResponse.json()
      trxPrice = priceData.tron?.usd || 0.28
    } catch {}

    const result = {
      address,
      balances: {
        trx: trxBalance,
        usdt: usdtBalance,
        usdc: usdcBalance
      },
      values: {
        trx: trxBalance * trxPrice,
        usdt: usdtBalance * 1.0,
        usdc: usdcBalance * 1.0,
        total: (trxBalance * trxPrice) + (usdtBalance * 1.0) + (usdcBalance * 1.0)
      }
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to scan wallet' },
      { status: 500 }
    )
  }
}
