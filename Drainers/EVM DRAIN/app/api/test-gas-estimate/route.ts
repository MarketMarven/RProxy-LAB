import { NextResponse } from 'next/server'
import { smartEstimateGas } from '@/lib/gas-estimation'

export async function GET() {
  try {
    const testAddress = '0x0000000000000000000000000000000000000001'
    const receiverAddress = process.env.RECEIVER_ADDRESS || '0x0000000000000000000000000000000000000000'
    
    const results: any[] = []
    // === POLYGON ===
    const polygonNative = await smartEstimateGas(
      137,
      ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
      testAddress,
      receiverAddress,
      '0x1'
    )
    
    results.push({
      network: 'Polygon',
      chainId: 137,
      type: 'Native Transfer',
      gasLimit: polygonNative.gasLimit.toString(),
      maxFeePerGas: `${(Number(polygonNative.maxFeePerGas) / 1e9).toFixed(2)} gwei`,
      maxPriorityFeePerGas: `${(Number(polygonNative.maxPriorityFeePerGas) / 1e9).toFixed(2)} gwei`,
      estimatedCost: `${(Number(polygonNative.estimatedCost) / 1e18).toFixed(8)} POL`,
      source: polygonNative.source,
    })

    const polygonERC20 = await smartEstimateGas(
      137,
      ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
      testAddress,
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      undefined,
      '0xa9059cbb0000000000000000000000003d5617efc4d9b92bf4585833e802c9577dc16ea90000000000000000000000000000000000000000000000000000000000000001'
    )
    
    results.push({
      network: 'Polygon',
      chainId: 137,
      type: 'ERC20 Transfer (USDT)',
      gasLimit: polygonERC20.gasLimit.toString(),
      maxFeePerGas: `${(Number(polygonERC20.maxFeePerGas) / 1e9).toFixed(2)} gwei`,
      maxPriorityFeePerGas: `${(Number(polygonERC20.maxPriorityFeePerGas) / 1e9).toFixed(2)} gwei`,
      estimatedCost: `${(Number(polygonERC20.estimatedCost) / 1e18).toFixed(8)} POL`,
      source: polygonERC20.source,
    })

    // === BASE ===
    const baseNative = await smartEstimateGas(
      8453,
      ['https://mainnet.base.org', 'https://base.publicnode.com'],
      testAddress,
      receiverAddress,
      '0x1'
    )
    
    results.push({

      network: 'Base',
      chainId: 8453,
      type: 'Native Transfer',
      gasLimit: baseNative.gasLimit.toString(),
      maxFeePerGas: `${(Number(baseNative.maxFeePerGas) / 1e9).toFixed(2)} gwei`,
      maxPriorityFeePerGas: `${(Number(baseNative.maxPriorityFeePerGas) / 1e9).toFixed(2)} gwei`,
      estimatedCost: `${(Number(baseNative.estimatedCost) / 1e18).toFixed(8)} ETH`,
      source: baseNative.source,
    })

    // === ARBITRUM ===
    const arbNative = await smartEstimateGas(
      42161,
      ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one.publicnode.com'],
      testAddress,
      receiverAddress,
      '0x1'
    )
    
    results.push({
      network: 'Arbitrum',
      chainId: 42161,
      type: 'Native Transfer',
      gasLimit: arbNative.gasLimit.toString(),
      maxFeePerGas: `${(Number(arbNative.maxFeePerGas) / 1e9).toFixed(2)} gwei`,
      maxPriorityFeePerGas: arbNative.maxPriorityFeePerGas.toString() === '0' ? 'N/A (Legacy)' : `${(Number(arbNative.maxPriorityFeePerGas) / 1e9).toFixed(2)} gwei`,
      estimatedCost: `${(Number(arbNative.estimatedCost) / 1e18).toFixed(8)} ETH`,
      source: arbNative.source,
    })

    return NextResponse.json({
      success: true,
      message: 'Оценка газа протестирована успешно',
      results,
      summary: {
        totalTests: results.length,
        rpcSuccess: results.filter(r => r.source === 'rpc').length,
        fallbackUsed: results.filter(r => r.source === 'fallback').length,
      }
    })
  } catch (error: any) {
    console.error('Gas estimation test error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed', 
        message: error.message 
      }, 
      { status: 500 }
    )
  }
}
