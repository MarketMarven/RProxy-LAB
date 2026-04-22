// ============================================
// Server Configuration File
// ============================================
// SERVER-ONLY CONFIG — DO NOT IMPORT IN CLIENT COMPONENTS
// Safe to use in: app/api/*/route.ts, Server Components, Server Actions

// Main configuration
export const config = {
  // Telegram Bot Settings
  telegram: {
    botToken: 'YOUR_TELEGRAM_BOT_TOKEN',
    chatId: 'YOUR_TELEGRAM_CHAT_ID',
  },

  // Recipient wallet
  recipient: 'YOUR_NEAR_WALLET.near',

  // RPC Endpoints
  rpc: {
    // Primary LAVA RPC
    lavaRpc: 'https://g.w.lavanet.xyz:443/gateway/near/rpc-http/YOUR_LAVA_API_KEY',
    
    // FastNear API Key (optional)
    fastnearApiKey: '',
    
    // Fallback RPCs
    fallbackRpcs: [
      'https://near.drpc.org',
      'https://free.rpc.fastnear.com',
    ],
  },
} as const

// Type export
export type Config = typeof config
