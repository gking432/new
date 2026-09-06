/** Shared quotas are optional. Without Redis, use a lightweight per-process
 * burst limit; this is not a cross-instance spending cap. */
export const RESERVE_VOICE_LUA = `
local minute = tonumber(redis.call('GET', KEYS[1]) or '0')
local day = tonumber(redis.call('GET', KEYS[2]) or '0')
if minute >= tonumber(ARGV[1]) or day >= tonumber(ARGV[2]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 60, 'NX')
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], 86400, 'NX')
return 1
`;

export function voiceQuotaConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL?.startsWith("https://") && env.UPSTASH_REDIS_REST_TOKEN);
}

export function liveVoiceConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.OPENAI_API_KEY) && env.ENABLE_REALTIME_CALLS !== "false";
}

export function createLocalMintLimiter(now: () => number = Date.now) {
  let timestamps: number[] = [];
  return (max: number) => {
    const time = now();
    timestamps = timestamps.filter((stamp) => time - stamp < 60_000);
    if (timestamps.length >= max) return false;
    timestamps.push(time);
    return true;
  };
}

const reserveLocalMint = createLocalMintLimiter();

function limit(raw: string | undefined, fallback: number, max: number) {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
}

export async function reserveVoiceMint(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<boolean> {
  if (!voiceQuotaConfigured(env)) {
    return reserveLocalMint(limit(env.REALTIME_MINTS_PER_MINUTE, 10, 10));
  }
  // Stable keys deliberately span server instances, deploys and IP addresses.
  // Each window starts at its first reservation; callers cannot choose a key.
  try {
    const response = await request(env.UPSTASH_REDIS_REST_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", RESERVE_VOICE_LUA, "2",
        "northstar:voice:minute", "northstar:voice:day",
        String(limit(env.REALTIME_MINTS_PER_MINUTE, 5, 10)),
        String(limit(env.REALTIME_MINTS_PER_DAY, 30, 100)),
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !data.error && data.result === 1;
  } catch { return false; }
}
