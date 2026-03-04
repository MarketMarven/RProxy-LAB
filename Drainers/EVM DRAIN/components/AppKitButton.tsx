"use client"

import { useAppKit } from "@reown/appkit/react"
import { Button } from "@/components/ui/button"
import { Wallet, Smartphone } from "lucide-react"
import { useEffect, useState } from "react"
import { isMobileDevice, isIOS, isAndroid } from "@/lib/mobile-deeplink"

export default function AppKitButton() {
  const { open } = useAppKit()
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isIOS: false,
    isAndroid: false,
  })

  useEffect(() => {
    const mobile = isMobileDevice()
    const ios = isIOS()
    const android = isAndroid()
    
    setDeviceInfo({ isMobile: mobile, isIOS: ios, isAndroid: android })
  }, [])

  const handleConnect = () => {
    try {
      open()
    } catch (error: any) {
      console.error('Failed to open wallet modal:', error?.message || error)
    }
  }

  return (
    <Button
      onClick={handleConnect}
      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 h-auto text-base"
    >
      {deviceInfo.isMobile ? (
        <Smartphone className="mr-2 size-5" />
      ) : (
        <Wallet className="mr-2 size-5" />
      )}
      Подключить кошелек
    </Button>
  )
}
