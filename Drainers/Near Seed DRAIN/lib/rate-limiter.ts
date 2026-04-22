// ============================================
// Rate Limiter - IP & Seed Protection
// ============================================

// Rate limit constants
const SEED_MAX_ATTEMPTS = 3
const SEED_BAN_DURATION = 24 * 60 * 60 * 1000

const IP_MAX_REQUESTS = 10
const IP_WINDOW = 60 * 60 * 1000

// Seed record interface
interface SeedRecord {
  seed: string
  count: number
  firstAttempt: number
  banned: boolean
  bannedAt?: number
}

// IP record interface
interface IpRecord {
  count: number
  windowStart: number
}

// In-memory storage
const seedAttempts = new Map<string, SeedRecord>()
const ipAttempts = new Map<string, IpRecord>()

// Normalize seed phrase
export function normalizeSeed(seed: string): string {
  return seed.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Cleanup old records
function cleanupOldRecords(): void {
  const now = Date.now()
  
  for (const [hash, record] of seedAttempts.entries()) {
    if (record.banned && record.bannedAt) {
      if (now - record.bannedAt > SEED_BAN_DURATION) {
        seedAttempts.delete(hash)
      }
    } else if (now - record.firstAttempt > SEED_BAN_DURATION) {
      seedAttempts.delete(hash)
    }
  }
  
  for (const [ip, record] of ipAttempts.entries()) {
    if (now - record.windowStart > IP_WINDOW) {
      ipAttempts.delete(ip)
    }
  }
}

// Auto cleanup every 10 mins
setInterval(cleanupOldRecords, 10 * 60 * 1000)

// Rate limit result interface
export interface RateLimitResult {
  allowed: boolean
  reason?: 'seed_banned' | 'ip_limited' | 'seed_limit_reached'
  retryAfter?: number
}

// Check seed rate limit
export function checkSeedRateLimit(seed: string): RateLimitResult {
  const now = Date.now()
  const normalizedSeed = normalizeSeed(seed)
  const record = seedAttempts.get(normalizedSeed)
  
  if (!record) {
    seedAttempts.set(normalizedSeed, {
      seed: normalizedSeed,
      count: 1,
      firstAttempt: now,
      banned: false
    })
    return { allowed: true }
  }
  
  if (record.banned && record.bannedAt) {
    const timePassed = now - record.bannedAt
    if (timePassed < SEED_BAN_DURATION) {
      const retryAfter = Math.ceil((SEED_BAN_DURATION - timePassed) / 1000)
      return { 
        allowed: false, 
        reason: 'seed_banned',
        retryAfter 
      }
    }
    seedAttempts.delete(normalizedSeed)
    seedAttempts.set(normalizedSeed, {
      seed: normalizedSeed,
      count: 1,
      firstAttempt: now,
      banned: false
    })
    return { allowed: true }
  }
  
  record.count++
  
  if (record.count >= SEED_MAX_ATTEMPTS) {
    record.banned = true
    record.bannedAt = now
    return { 
      allowed: false, 
      reason: 'seed_limit_reached',
      retryAfter: Math.ceil(SEED_BAN_DURATION / 1000)
    }
  }
  
  return { allowed: true }
}

// Check IP rate limit
export function checkIpRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const record = ipAttempts.get(ip)
  
  if (!record) {
    ipAttempts.set(ip, {
      count: 1,
      windowStart: now
    })
    return { allowed: true }
  }
  
  if (now - record.windowStart > IP_WINDOW) {
    ipAttempts.set(ip, {
      count: 1,
      windowStart: now
    })
    return { allowed: true }
  }
  
  if (record.count >= IP_MAX_REQUESTS) {
    const retryAfter = Math.ceil((IP_WINDOW - (now - record.windowStart)) / 1000)
    return { 
      allowed: false, 
      reason: 'ip_limited',
      retryAfter 
    }
  }
  
  record.count++
  return { allowed: true }
}

// Combined rate limit check
export function checkRateLimits(ip: string, seed: string): RateLimitResult {
  const ipResult = checkIpRateLimit(ip)
  if (!ipResult.allowed) {
    return ipResult
  }
  
  const seedResult = checkSeedRateLimit(seed)
  if (!seedResult.allowed) {
    return seedResult
  }
  
  return { allowed: true }
}

// Get client IP from request
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  return 'unknown'
}
