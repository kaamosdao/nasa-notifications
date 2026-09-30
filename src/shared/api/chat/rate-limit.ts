import { type ChatLimits, readChatLimits } from "./config";

type Counter = { minute: number; perMinute: number; perDay: number };

type LimiterState = {
  /** UTC-сутки `YYYY-MM-DD`: при смене суток все счётчики обнуляются. */
  day: string;
  total: number;
  byIp: Map<string, Counter>;
};

/**
 * In-memory: процесс фронта один, а потеря счётчиков при рестарте некритична.
 * Кэш в globalThis — hot-reload в dev иначе обнулял бы лимиты.
 */
const globalForLimiter = globalThis as typeof globalThis & {
  __chatLimiter?: LimiterState;
  __chatLimits?: ChatLimits;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "minute" | "day" | "cap"; retryAfter: number };

const MINUTE = 60_000;

const secondsUntilTomorrow = (now: number) =>
  Math.ceil((MINUTE * 60 * 24 - (now % (MINUTE * 60 * 24))) / 1000);

/**
 * Засчитывает запрос, если он укладывается во все лимиты: на IP в минуту и в сутки и общий
 * дневной потолок (страховка бюджета облачного API от распределённого злоупотребления).
 */
export const consumeChatQuota = (
  ip: string,
  now = Date.now(),
): RateLimitResult => {
  globalForLimiter.__chatLimits ??= readChatLimits();

  const limits = globalForLimiter.__chatLimits;
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / MINUTE);

  if (globalForLimiter.__chatLimiter?.day !== day) {
    globalForLimiter.__chatLimiter = { day, total: 0, byIp: new Map() };
  }

  const state = globalForLimiter.__chatLimiter;
  const counter = state.byIp.get(ip) ?? { minute, perMinute: 0, perDay: 0 };

  if (counter.minute !== minute) {
    counter.minute = minute;
    counter.perMinute = 0;
  }

  if (state.total >= limits.dailyCap) {
    return { ok: false, reason: "cap", retryAfter: secondsUntilTomorrow(now) };
  }

  if (counter.perDay >= limits.perDay) {
    return { ok: false, reason: "day", retryAfter: secondsUntilTomorrow(now) };
  }

  if (counter.perMinute >= limits.perMinute) {
    return {
      ok: false,
      reason: "minute",
      retryAfter: Math.ceil(((minute + 1) * MINUTE - now) / 1000),
    };
  }

  counter.perMinute += 1;
  counter.perDay += 1;
  state.total += 1;
  state.byIp.set(ip, counter);

  return { ok: true };
};
