"""
Real crypto price data (CoinGecko's free, no-API-key public API) for the
Crypto Impulse Check page (crypto-impulse.html).

Unlike turtle-sim.js's Turtle Trading simulator — whose price series comes
from a seeded PRNG (mulberry32/generatePriceSeries), entirely synthetic —
this page's practice scenarios are drawn from ACTUAL historical BTC/ETH
volatility events: real single-day price moves CoinGecko's own data shows
happened, with the real 14 days before and after. No API key required, so
there's nothing to rotate or leak; a 5-minute in-memory cache keeps this
well under CoinGecko's free-tier rate limit even under repeated page loads.
"""

import json
import random
import time
import urllib.error
import urllib.request

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
SUPPORTED_COINS = {"bitcoin": "BTC", "ethereum": "ETH"}
CACHE_TTL_SECONDS = 300

_cache = {}


class CryptoAPIError(Exception):
    """Raised on any CoinGecko fetch failure — callers degrade the same
    way the app already does for llm.LLMError / coach_agent.AgentUnavailable:
    a clear error surfaced to the user, never a silent wrong answer."""


def _fetch_json(url, timeout=10):
    """Isolated to one function so tests mock this instead of urllib
    internals — the same pattern coach_agent.py uses for _require_langchain."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FinPerson/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as err:
        raise CryptoAPIError(f"CoinGecko request failed: {err}") from err


def _cached_fetch(cache_key, url):
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and (now - cached[0]) < CACHE_TTL_SECONDS:
        return cached[1]
    data = _fetch_json(url)
    _cache[cache_key] = (now, data)
    return data


def _require_supported(coin_id):
    if coin_id not in SUPPORTED_COINS:
        raise ValueError(f"unsupported coin: {coin_id!r} (supported: {sorted(SUPPORTED_COINS)})")


def get_current_price(coin_id="bitcoin"):
    _require_supported(coin_id)
    url = f"{COINGECKO_BASE}/simple/price?ids={coin_id}&vs_currencies=usd"
    data = _cached_fetch(f"price:{coin_id}", url)
    return data[coin_id]["usd"]


def get_market_chart(coin_id="bitcoin", days=365):
    """Returns real daily [{"t": unix_ms, "price": float}, ...], oldest first."""
    _require_supported(coin_id)
    url = f"{COINGECKO_BASE}/coins/{coin_id}/market_chart?vs_currency=usd&days={days}&interval=daily"
    data = _cached_fetch(f"chart:{coin_id}:{days}", url)
    return [{"t": int(t), "price": float(p)} for t, p in data["prices"]]


def detect_volatility_events(prices, threshold_pct=8, lead_in_days=14, outcome_days=14):
    """Scans a real price series for single-day moves >= threshold_pct in
    either direction, with enough real lead-in/outcome context on both
    sides to drive a "what would you do, and what actually happened"
    exercise. Deliberately simple (a rolling single-day % check, not a
    volatility-clustering model) — the point is finding real moments that
    actually happened, not modelling volatility itself."""
    events = []
    for i in range(lead_in_days, len(prices) - outcome_days):
        prev_price = prices[i - 1]["price"]
        curr_price = prices[i]["price"]
        if prev_price <= 0:
            continue
        pct_change = (curr_price - prev_price) / prev_price * 100
        if abs(pct_change) < threshold_pct:
            continue
        outcome = prices[i + 1:i + 1 + outcome_days]
        events.append({
            "event_timestamp": prices[i]["t"],
            "pct_change": round(pct_change, 2),
            "direction": "drop" if pct_change < 0 else "spike",
            "price_at_event": curr_price,
            "lead_in": prices[i - lead_in_days:i + 1],
            "outcome": outcome,
            "price_after_outcome": outcome[-1]["price"] if outcome else None,
        })
    return events


def pick_scenario(coin_id="bitcoin", threshold_pct=8, days=365, seed=None):
    """Returns one real volatility event, or None if this coin's last
    `days` of data has no move past threshold_pct (rare but possible —
    callers should handle None rather than assume a scenario always exists)."""
    prices = get_market_chart(coin_id, days=days)
    events = detect_volatility_events(prices, threshold_pct=threshold_pct)
    if not events:
        return None
    rng = random.Random(seed)
    return rng.choice(events)


def find_event_by_timestamp(coin_id, event_timestamp, threshold_pct=8, days=365):
    """Re-derives a specific event for the reveal step (POST /api/crypto/decision)
    — the scenario_id round-tripped from the client encodes coin_id + this
    timestamp rather than a raw list index, so a cache refresh between the
    GET and the POST can't silently point at a different day's event."""
    prices = get_market_chart(coin_id, days=days)
    events = detect_volatility_events(prices, threshold_pct=threshold_pct)
    for event in events:
        if event["event_timestamp"] == event_timestamp:
            return event
    return None
