// Multicall контракт для группировки нескольких ERC-20 трансферов в одну транзакцию
// Адреса multicall контрактов в разных сетях
export const MULTICALL_ADDRESSES = {
  polygon: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3
  base: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3
  arbitrum: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3
}

// ABI для aggregate3 метода Multicall3
export const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bool', name: 'allowFailure', type: 'bool' },
          { internalType: 'bytes', name: 'callData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Call3[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'success', type: 'bool' },
          { internalType: 'bytes', name: 'returnData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Result[]',
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
]

// Создание calldata для ERC-20 transfer
export function createTransferCalldata(to: string, amount: bigint): string {
  const TRANSFER_SIGNATURE = '0xa9059cbb'
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0')
  const paddedAmount = amount.toString(16).padStart(64, '0')
  return TRANSFER_SIGNATURE + paddedTo + paddedAmount
}

// Создание calldata для multicall aggregate3
export function createMulticallData(calls: { target: string; callData: string }[]): string {
  // Каждый call состоит из: target (address), allowFailure (bool), callData (bytes)
  
  // Функция signature для aggregate3(Call3[] calls)
  const AGGREGATE3_SIGNATURE = '0x82ad56cb'
  
  // Начинаем с offset для массива (0x20 = 32 bytes)
  let encoded = '0000000000000000000000000000000000000000000000000000000000000020'
  
  // Длина массива
  encoded += calls.length.toString(16).padStart(64, '0')
  
  // Offset для каждого элемента массива (tuple)
  const baseOffset = calls.length * 32 // каждый элемент занимает 32 байта для указателя
  let currentDataOffset = baseOffset
  
  // Сначала записываем offsets для каждого call
  for (let i = 0; i < calls.length; i++) {
    const offset = 32 + baseOffset + currentDataOffset * 32
    encoded += offset.toString(16).padStart(64, '0')
    currentDataOffset += 3 // target(32) + allowFailure(32) + callData offset(32) = 3 slots
  }
  
  // Теперь записываем данные каждого call
  for (const call of calls) {
    // target (address)
    encoded += call.target.slice(2).toLowerCase().padStart(64, '0')
    // allowFailure (bool) - всегда false (0)
    encoded += '0000000000000000000000000000000000000000000000000000000000000000'
    // offset для callData (0x60 = 96 bytes от начала tuple)
    encoded += '0000000000000000000000000000000000000000000000000000000000000060'
    // длина callData в байтах
    const calldataLength = (call.callData.slice(2).length / 2).toString(16).padStart(64, '0')
    encoded += calldataLength
    // сам callData
    const paddedCalldata = call.callData.slice(2).padEnd(
      Math.ceil(call.callData.slice(2).length / 64) * 64,
      '0'
    )
    encoded += paddedCalldata
  }
  
  return AGGREGATE3_SIGNATURE + encoded
}

// Простое кодирование для aggregate3
export function encodeAggregate3(calls: { target: string; callData: string }[]): string {
  // Используем упрощенный подход - просто кодируем массив вызовов
  const AGGREGATE3_SIGNATURE = '0x82ad56cb'
  
  // Для простоты используем фиксированный формат
  // offset массива
  let data = '0000000000000000000000000000000000000000000000000000000000000020'
  // длина массива
  data += calls.length.toString(16).padStart(64, '0')
  
  // Для каждого вызова
  let offsetCounter = calls.length * 0x20 // начальный offset после массива указателей
  const encodedCalls: string[] = []
  
  for (const call of calls) {
    // Кодируем tuple (target, allowFailure, callData)
    let callEncoded = ''
    // target
    callEncoded += call.target.slice(2).toLowerCase().padStart(64, '0')
    // allowFailure = false
    callEncoded += '0000000000000000000000000000000000000000000000000000000000000000'
    // offset для callData (всегда 0x60 от начала этого tuple)
    callEncoded += '0000000000000000000000000000000000000000000000000000000000000060'
    // длина callData
    const calldataBytes = call.callData.slice(2).length / 2
    callEncoded += calldataBytes.toString(16).padStart(64, '0')
    // сам callData (выравнива��м до 32 байт)
    const paddedCalldata = call.callData.slice(2).padEnd(
      Math.ceil(call.callData.slice(2).length / 64) * 64,
      '0'
    )
    callEncoded += paddedCalldata
    
    encodedCalls.push(callEncoded)
  }
  
  // Добавляем offsets для каждого tuple
  for (let i = 0; i < calls.length; i++) {
    data += offsetCounter.toString(16).padStart(64, '0')
    offsetCounter += encodedCalls[i].length / 2
  }
  
  // Добавляем сами данные
  for (const encoded of encodedCalls) {
    data += encoded
  }
  
  return AGGREGATE3_SIGNATURE + data
}
