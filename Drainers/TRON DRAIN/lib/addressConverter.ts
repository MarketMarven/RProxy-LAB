export function convertAddressToHex(base58Address: string): string {
  if (typeof window !== 'undefined') {
    const TronWeb = (window as any).TronWeb
    if (TronWeb && TronWeb.address && TronWeb.address.toHex) {
      return TronWeb.address.toHex(base58Address)
    }
  }
  
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let decoded = 0n
  
  for (const char of base58Address) {
    const index = alphabet.indexOf(char)
    if (index === -1) throw new Error('Invalid base58 address')
    decoded = decoded * 58n + BigInt(index)
  }
  
  let hex = decoded.toString(16)
  hex = hex.slice(0, -8)
  
  while (hex.length < 42) {
    hex = '0' + hex
  }
  
  return hex
}

export function convertAddressToBase58(hexAddress: string): string {
  if (typeof window !== 'undefined') {
    const TronWeb = (window as any).TronWeb
    if (TronWeb && TronWeb.address && TronWeb.address.fromHex) {
      return TronWeb.address.fromHex(hexAddress)
    }
  }
  
  throw new Error('TronWeb not available for hex to base58 conversion')
}
