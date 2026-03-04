/**
 * Умная система расчета комиссий для Polygon и других сетей
 * Приоритет: RPC -> Fallback на локальную симуляцию
 */

export interface GasEstimate {
  gasLimit: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  estimatedCost: bigint
  source: 'rpc' | 'fallback'
  success: boolean
  error?: string
}

export interface NetworkGasConfig {
  supportsEIP1559: boolean
  fallbackGasLimit: {
    native: bigint
    erc20: bigint
  }
  fallbackMaxFeePerGas: bigint
  fallbackMaxPriorityFeePerGas: bigint
  gasBuffer: number
}


const GAS_CONFIGS: Record<number, NetworkGasConfig> = {
  // Polygon (EIP-1559)
  137: {
    supportsEIP1559: true,
    fallbackGasLimit: {
      native: BigInt(21000),
      erc20: BigInt(65000),
    },
    fallbackMaxFeePerGas: BigInt(150_000_000_000),
    fallbackMaxPriorityFeePerGas: BigInt(30_000_000_000),
    gasBuffer: 20,
  },
  // Base (EIP-1559)
  8453: {
    supportsEIP1559: true,
    fallbackGasLimit: {
      native: BigInt(21000),
      erc20: BigInt(65000),
    },
    fallbackMaxFeePerGas: BigInt(1_000_000_000),
    fallbackMaxPriorityFeePerGas: BigInt(100_000_000),
    gasBuffer: 20,
  },
  // Arbitrum 
  42161: {
    supportsEIP1559: false,
    fallbackGasLimit: {
      native: BigInt(21000),
      erc20: BigInt(200000),
    },
    fallbackMaxFeePerGas: BigInt(100_000_000),
    fallbackMaxPriorityFeePerGas: BigInt(0),
    gasBuffer: 30,
  },
}

/**
 * 
 */
async function getEIP1559GasFromRPC(rpcUrls: string[], chainId: number): Promise<{
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  baseFeePerGas: bigint
  success: boolean
}> {
  for (const rpcUrl of rpcUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const [blockResponse, priorityFeeResponse] = await Promise.all([
        fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBlockByNumber',
            params: ['latest', false],
            id: 1,
          }),
          signal: controller.signal,
        }),
        fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_maxPriorityFeePerGas',
            params: [],
            id: 2,
          }),
          signal: controller.signal,
        })
      ])
      
      clearTimeout(timeout)
      
      const blockData = await blockResponse.json()
      const priorityFeeData = await priorityFeeResponse.json()
      
      if (blockData.result?.baseFeePerGas && priorityFeeData.result) {
        const baseFeePerGas = BigInt(blockData.result.baseFeePerGas)
        const maxPriorityFeePerGas = BigInt(priorityFeeData.result)
        const maxFeePerGas = baseFeePerGas * BigInt(2) + maxPriorityFeePerGas
        
        return {
          maxFeePerGas,
          maxPriorityFeePerGas,
          baseFeePerGas,
          success: true,
        }
      }
    } catch (error) {
      continue
    }
  }
  
  return {
    maxFeePerGas: BigInt(0),
    maxPriorityFeePerGas: BigInt(0),
    baseFeePerGas: BigInt(0),
    success: false,
  }
}

/**
 * 
 */
async function getLegacyGasPriceFromRPC(rpcUrls: string[]): Promise<{
  gasPrice: bigint
  success: boolean
}> {
  for (const rpcUrl of rpcUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeout)
      const data = await response.json()
      
      if (data.result) {
        const gasPrice = BigInt(data.result)
        return { gasPrice, success: true }
      }
    } catch (error) {
      continue
    }
  }
  
  return { gasPrice: BigInt(0), success: false }
}

/**
 * 
 */
async function estimateGasLimitFromRPC(
  rpcUrls: string[],
  from: string,
  to: string,
  value?: string,
  data?: string
): Promise<{ gasLimit: bigint; success: boolean }> {
  const txParams: any = { from, to }
  if (value) txParams.value = value
  if (data) txParams.data = data

  for (const rpcUrl of rpcUrls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [txParams],
          id: 1,
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeout)
      const result = await response.json()
      
      if (result.result) {
        const gasLimit = BigInt(result.result)
        return { gasLimit, success: true }
      }
    } catch (error) {
      continue
    }
  }
  
  return { gasLimit: BigInt(0), success: false }
}

/**
 * 
 */
export async function smartEstimateGas(
  chainId: number,
  rpcUrls: string[],
  from: string,
  to: string,
  value?: string,
  data?: string
): Promise<GasEstimate> {
  const config = GAS_CONFIGS[chainId]
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  let gasLimit = BigInt(0)
  let maxFeePerGas = BigInt(0)
  let maxPriorityFeePerGas = BigInt(0)
  let usedFallback = false


  const gasLimitEstimate = await estimateGasLimitFromRPC(rpcUrls, from, to, value, data)
  
  if (gasLimitEstimate.success) {
    gasLimit = (gasLimitEstimate.gasLimit * BigInt(100 + config.gasBuffer)) / BigInt(100)
  } else {
    gasLimit = data ? config.fallbackGasLimit.erc20 : config.fallbackGasLimit.native
    usedFallback = true
  }


  if (config.supportsEIP1559) {
    const eip1559 = await getEIP1559GasFromRPC(rpcUrls, chainId)
    
    if (eip1559.success) {
      maxFeePerGas = eip1559.maxFeePerGas
      maxPriorityFeePerGas = eip1559.maxPriorityFeePerGas
      
      maxFeePerGas = (maxFeePerGas * BigInt(100 + config.gasBuffer)) / BigInt(100)
      maxPriorityFeePerGas = (maxPriorityFeePerGas * BigInt(100 + config.gasBuffer)) / BigInt(100)
    } else {
      maxFeePerGas = config.fallbackMaxFeePerGas
      maxPriorityFeePerGas = config.fallbackMaxPriorityFeePerGas
      usedFallback = true
    }
  } else {
    const legacyGas = await getLegacyGasPriceFromRPC(rpcUrls)
    
    if (legacyGas.success) {
      maxFeePerGas = (legacyGas.gasPrice * BigInt(100 + config.gasBuffer)) / BigInt(100)
      maxPriorityFeePerGas = BigInt(0)
    } else {
      maxFeePerGas = config.fallbackMaxFeePerGas
      maxPriorityFeePerGas = BigInt(0)
      usedFallback = true
    }
  }

  const estimatedCost = gasLimit * maxFeePerGas

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    estimatedCost,
    source: usedFallback ? 'fallback' : 'rpc',
    success: true,
  }
}
