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

donchian_signal() below is the same Donchian-channel breakout rule as
turtle-sim.js's donchianSignal() (buy on a new N-day high, sell on a new
N-day low) — deliberately re-implemented rather than shared, since one
runs client-side on synthetic data and this runs server-side on real
CoinGecko data. Tagging each real volatility event with that same rule and
checking whether the move actually continued over the following 14 real
days turns "does trend-following work" from turtle-sim's synthetic
teaching exercise into a small real backtest: see
breakout_continuation_stats() / get_breakout_stats().
"""

import json
import random
import time
import urllib.error
import urllib.request

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
SUPPORTED_COINS = {"bitcoin": "BTC", "ethereum": "ETH"}
CACHE_TTL_SECONDS = 300

# Matches PERIOD in pro-turtle-page.js, so "breakout" means the same thing
# on both the synthetic turtle-sim and this real-data page.
DONCHIAN_PERIOD = 10

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


def donchian_signal(prices, index, period=DONCHIAN_PERIOD):
    """The exact rule turtle-sim.js's donchianSignal() plays: "buy" if the
    price at `index` is a new high over the `period` prices strictly
    before it, "sell" if it's a new low, else "hold". Not every big
    single-day move is also a channel breakout (a huge spike inside an
    already-wider recent range isn't a new extreme) — that's real
    information, not a bug, so callers should expect "hold" sometimes."""
    if index < period:
        return "hold"
    window = [p["price"] for p in prices[index - period:index]]
    high, low = max(window), min(window)
    current = prices[index]["price"]
    if current > high:
        return "buy"
    if current < low:
        return "sell"
    return "hold"


def detect_volatility_events(prices, threshold_pct=8, lead_in_days=14, outcome_days=14, period=DONCHIAN_PERIOD):
    """Scans a real price series for single-day moves >= threshold_pct in
    either direction, with enough real lead-in/outcome context on both
    sides to drive a "what would you do, and what actually happened"
    exercise. Deliberately simple (a rolling single-day % check, not a
    volatility-clustering model) — the point is finding real moments that
    actually happened, not modelling volatility itself.

    Each event also carries a real Donchian breakout_signal (see
    donchian_signal()) and, when that signal is directional, whether price
    actually kept moving that way (breakout_continued) by the end of the
    real outcome window — the turtle-trading "did the breakout hold"
    question, answered with real data rather than assumed."""
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
        price_after_outcome = outcome[-1]["price"] if outcome else None
        signal = donchian_signal(prices, i, period=period)
        continued = None
        if signal == "buy" and price_after_outcome is not None:
            continued = price_after_outcome > curr_price
        elif signal == "sell" and price_after_outcome is not None:
            continued = price_after_outcome < curr_price
        events.append({
            "event_timestamp": prices[i]["t"],
            "pct_change": round(pct_change, 2),
            "direction": "drop" if pct_change < 0 else "spike",
            "price_at_event": curr_price,
            "lead_in": prices[i - lead_in_days:i + 1],
            "outcome": outcome,
            "price_after_outcome": price_after_outcome,
            "breakout_signal": signal,
            "breakout_continued": continued,
        })
    return events


def breakout_continuation_stats(events):
    """Aggregates the breakout_signal/breakout_continued fields detect_
    volatility_events already attached: of the real moments that were
    also a Donchian breakout, how often did price actually keep going the
    breakout's direction? "hold" signals (a big move that wasn't a new
    channel extreme) are excluded — there's no direction to check
    continuation against."""
    by_direction = {"buy": {"n": 0, "continued": 0}, "sell": {"n": 0, "continued": 0}}
    for event in events:
        signal = event.get("breakout_signal")
        if signal not in ("buy", "sell") or event.get("breakout_continued") is None:
            continue
        by_direction[signal]["n"] += 1
        if event["breakout_continued"]:
            by_direction[signal]["continued"] += 1

    def _rate(n, continued):
        return round(continued / n * 100, 1) if n else None

    n_breakouts = by_direction["buy"]["n"] + by_direction["sell"]["n"]
    n_continued = by_direction["buy"]["continued"] + by_direction["sell"]["continued"]
    return {
        "n_breakouts": n_breakouts,
        "n_continued": n_continued,
        "continuation_rate": _rate(n_breakouts, n_continued),
        "by_direction": {
            direction: {**counts, "continuation_rate": _rate(counts["n"], counts["continued"])}
            for direction, counts in by_direction.items()
        },
    }


def action_return_pct(event, action):
    """Same convention as turtle-sim.js's actionReturnPct: "buy" profits if
    price rises by the outcome, "sell" (short) profits if it falls, "hold"
    is flat. Uses the real 14-day outcome window this page already reveals
    (price_at_event -> price_after_outcome), not a single next-day move —
    a different horizon than turtle-sim's per-round board, because that's
    the horizon this page's events are built around."""
    if action not in ("buy", "sell") or event.get("price_after_outcome") is None:
        return 0.0
    change_pct = (event["price_after_outcome"] - event["price_at_event"]) / event["price_at_event"] * 100
    return round(change_pct if action == "buy" else -change_pct, 2)


def list_session_events(coin_id="bitcoin", threshold_pct=8, days=365, period=DONCHIAN_PERIOD):
    """The chronological (oldest-first) roadmap a chained decision run
    steps through — every real volatility event for this coin in the
    order they actually happened. Each round's full lead-in chart is
    fetched one at a time via GET /api/crypto/scenario?event_timestamp=...
    so the player never sees more of the real timeline than the round
    they're currently on."""
    _require_supported(coin_id)
    prices = get_market_chart(coin_id, days=days)
    events = detect_volatility_events(prices, threshold_pct=threshold_pct, period=period)
    return [
        {
            "event_timestamp": e["event_timestamp"],
            "direction": e["direction"],
            "pct_change": e["pct_change"],
            "breakout_signal": e["breakout_signal"],
        }
        for e in events
    ]


def get_breakout_stats(coin_id="bitcoin", threshold_pct=8, days=365, period=DONCHIAN_PERIOD):
    """The endpoint-facing entry point: fetches real market data, detects
    events, and returns the aggregate real continuation rate for this
    coin — a small honest backtest, not a claim that trend-following
    "works" (sample sizes here are small; see breakout_continuation_stats'
    n_breakouts before reading anything into the rate)."""
    _require_supported(coin_id)
    prices = get_market_chart(coin_id, days=days)
    events = detect_volatility_events(prices, threshold_pct=threshold_pct, period=period)
    stats = breakout_continuation_stats(events)
    stats.update({"coin": coin_id, "period": period, "threshold_pct": threshold_pct, "days": days})
    return stats


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
