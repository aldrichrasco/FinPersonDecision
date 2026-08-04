"""
Tests for crypto.py (real CoinGecko integration, mocked here so the suite
never depends on live network access or CoinGecko's rate limit) and the
/api/crypto/* routes in server.py.
"""

import unittest
import unittest.mock

import crypto
import db
import server


def _fake_prices(n=60, start=100.0):
    """A controlled, deterministic price series with two known volatility
    events baked in at fixed indices, so detect_volatility_events has
    something real (within the fixture) to find without depending on
    actual market data."""
    prices = []
    price = start
    t0 = 1_700_000_000_000  # arbitrary fixed epoch-ms anchor
    for i in range(n):
        if i == 20:
            price *= 1.15  # +15% spike
        elif i == 40:
            price *= 0.85  # -15% drop
        else:
            price *= 1.001  # gentle drift, never crosses the default 8% threshold
        prices.append({"t": t0 + i * 86_400_000, "price": price})
    return prices


class VolatilityDetectionTests(unittest.TestCase):
    def test_finds_the_two_known_events(self):
        prices = _fake_prices()
        events = crypto.detect_volatility_events(prices, threshold_pct=8)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["direction"], "spike")
        self.assertEqual(events[1]["direction"], "drop")

    def test_each_event_carries_real_lead_in_and_outcome_context(self):
        prices = _fake_prices()
        events = crypto.detect_volatility_events(prices, threshold_pct=8, lead_in_days=14, outcome_days=14)
        for event in events:
            self.assertEqual(len(event["lead_in"]), 15)  # 14 days before + the event day itself
            self.assertEqual(len(event["outcome"]), 14)
            self.assertEqual(event["lead_in"][-1]["price"], event["price_at_event"])

    def test_no_events_below_threshold(self):
        prices = _fake_prices()
        events = crypto.detect_volatility_events(prices, threshold_pct=50)
        self.assertEqual(events, [])

    def test_gentle_drift_alone_never_triggers_an_event(self):
        # A price series with NO deliberate spike/drop should find nothing,
        # proving the detector isn't just flagging every day.
        prices = []
        price = 100.0
        for i in range(60):
            price *= 1.001
            prices.append({"t": i, "price": price})
        events = crypto.detect_volatility_events(prices, threshold_pct=8)
        self.assertEqual(events, [])


class DonchianBreakoutTests(unittest.TestCase):
    def test_holds_before_enough_lookback_exists(self):
        prices = _fake_prices()
        self.assertEqual(crypto.donchian_signal(prices, 5, period=10), "hold")

    def test_the_engineered_spike_is_a_real_new_high_breakout(self):
        prices = _fake_prices()
        # Index 20 is the fixture's engineered +15% spike; the 10 days
        # before it (10-19) are a gentle, monotonic uptrend, so the spike
        # is also a genuine new 10-day high, not just a big move.
        self.assertEqual(crypto.donchian_signal(prices, 20, period=10), "buy")

    def test_the_engineered_drop_is_a_real_new_low_breakout(self):
        prices = _fake_prices()
        self.assertEqual(crypto.donchian_signal(prices, 40, period=10), "sell")

    def test_a_move_that_stays_inside_the_recent_range_holds(self):
        # The 10-day window (indices 15-24) already contains a bigger swing
        # (up to 130) than day 25's price of 108, so 108 is neither a new
        # high nor a new low -- a real move, but not a channel breakout.
        window = [101, 102, 103, 104, 130, 110, 105, 103, 102, 101]
        values = [100] * 15 + window + [108]
        prices = [{"t": i, "price": v} for i, v in enumerate(values)]
        self.assertEqual(crypto.donchian_signal(prices, 25, period=10), "hold")

    def test_events_carry_a_breakout_signal_matching_their_direction(self):
        prices = _fake_prices()
        events = crypto.detect_volatility_events(prices, threshold_pct=8, period=10)
        spike, drop = events[0], events[1]
        self.assertEqual(spike["breakout_signal"], "buy")
        self.assertEqual(drop["breakout_signal"], "sell")
        self.assertIn(spike["breakout_continued"], (True, False))
        self.assertIn(drop["breakout_continued"], (True, False))


class BreakoutContinuationStatsTests(unittest.TestCase):
    def test_aggregates_across_directions(self):
        events = [
            {"breakout_signal": "buy", "breakout_continued": True},
            {"breakout_signal": "buy", "breakout_continued": False},
            {"breakout_signal": "sell", "breakout_continued": True},
            {"breakout_signal": "hold", "breakout_continued": None},
        ]
        stats = crypto.breakout_continuation_stats(events)
        self.assertEqual(stats["n_breakouts"], 3)
        self.assertEqual(stats["n_continued"], 2)
        self.assertAlmostEqual(stats["continuation_rate"], 66.7, places=1)
        self.assertEqual(stats["by_direction"]["buy"]["n"], 2)
        self.assertEqual(stats["by_direction"]["sell"]["n"], 1)

    def test_empty_events_gives_none_rate_not_a_crash(self):
        stats = crypto.breakout_continuation_stats([])
        self.assertEqual(stats["n_breakouts"], 0)
        self.assertIsNone(stats["continuation_rate"])

    def test_get_breakout_stats_end_to_end_on_the_fixture(self):
        prices = _fake_prices()
        with unittest.mock.patch.object(crypto, "get_market_chart", return_value=prices):
            stats = crypto.get_breakout_stats("bitcoin", threshold_pct=8)
        self.assertEqual(stats["coin"], "bitcoin")
        self.assertEqual(stats["period"], crypto.DONCHIAN_PERIOD)
        self.assertEqual(stats["n_breakouts"], 2)


class ActionReturnPctTests(unittest.TestCase):
    def setUp(self):
        self.event = {"price_at_event": 100.0, "price_after_outcome": 110.0}

    def test_buy_profits_when_price_rises(self):
        self.assertEqual(crypto.action_return_pct(self.event, "buy"), 10.0)

    def test_sell_profits_when_price_rises_is_negative(self):
        self.assertEqual(crypto.action_return_pct(self.event, "sell"), -10.0)

    def test_hold_is_always_flat(self):
        self.assertEqual(crypto.action_return_pct(self.event, "hold"), 0.0)

    def test_missing_outcome_is_flat_regardless_of_action(self):
        event = {"price_at_event": 100.0, "price_after_outcome": None}
        self.assertEqual(crypto.action_return_pct(event, "buy"), 0.0)


class SessionEventsTests(unittest.TestCase):
    def setUp(self):
        crypto._cache.clear()
        self.prices = _fake_prices()
        self.patcher = unittest.mock.patch.object(crypto, "get_market_chart", return_value=self.prices)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_returns_events_in_chronological_order(self):
        rounds = crypto.list_session_events("bitcoin", threshold_pct=8)
        self.assertEqual(len(rounds), 2)
        self.assertLess(rounds[0]["event_timestamp"], rounds[1]["event_timestamp"])
        self.assertEqual(rounds[0]["direction"], "spike")
        self.assertEqual(rounds[1]["direction"], "drop")

    def test_omits_lead_in_and_outcome_from_the_roadmap(self):
        rounds = crypto.list_session_events("bitcoin", threshold_pct=8)
        for r in rounds:
            self.assertNotIn("lead_in", r)
            self.assertNotIn("outcome", r)
            self.assertIn("breakout_signal", r)


class CachingAndFetchTests(unittest.TestCase):
    def setUp(self):
        crypto._cache.clear()

    def test_get_current_price_rejects_unsupported_coins(self):
        with self.assertRaises(ValueError):
            crypto.get_current_price("dogecoin")

    def test_get_current_price_uses_the_mocked_fetch(self):
        with unittest.mock.patch.object(crypto, "_fetch_json", return_value={"bitcoin": {"usd": 12345}}) as mocked:
            price = crypto.get_current_price("bitcoin")
        self.assertEqual(price, 12345)
        mocked.assert_called_once()

    def test_second_call_within_ttl_does_not_refetch(self):
        with unittest.mock.patch.object(crypto, "_fetch_json", return_value={"bitcoin": {"usd": 1}}) as mocked:
            crypto.get_current_price("bitcoin")
            crypto.get_current_price("bitcoin")
        self.assertEqual(mocked.call_count, 1)

    def test_fetch_failure_raises_crypto_api_error(self):
        with unittest.mock.patch.object(crypto, "_fetch_json", side_effect=crypto.CryptoAPIError("boom")):
            with self.assertRaises(crypto.CryptoAPIError):
                crypto.get_current_price("bitcoin")


class ScenarioRoundTripTests(unittest.TestCase):
    def setUp(self):
        crypto._cache.clear()
        self.prices = _fake_prices()
        self.patcher = unittest.mock.patch.object(
            crypto, "get_market_chart", return_value=self.prices
        )
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_pick_scenario_returns_one_of_the_known_events(self):
        scenario = crypto.pick_scenario("bitcoin", threshold_pct=8, seed=1)
        self.assertIsNotNone(scenario)
        self.assertIn(scenario["direction"], ("spike", "drop"))

    def test_find_event_by_timestamp_recovers_the_same_event(self):
        scenario = crypto.pick_scenario("bitcoin", threshold_pct=8, seed=1)
        found = crypto.find_event_by_timestamp("bitcoin", scenario["event_timestamp"], threshold_pct=8)
        self.assertIsNotNone(found)
        self.assertEqual(found["event_timestamp"], scenario["event_timestamp"])
        self.assertEqual(found["pct_change"], scenario["pct_change"])

    def test_find_event_by_timestamp_returns_none_for_an_unknown_timestamp(self):
        found = crypto.find_event_by_timestamp("bitcoin", 999999999999, threshold_pct=8)
        self.assertIsNone(found)


class CryptoRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        crypto._cache.clear()
        self.prices = _fake_prices()
        self.patcher = unittest.mock.patch.object(crypto, "get_market_chart", return_value=self.prices)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_price_endpoint_returns_the_mocked_price(self):
        with unittest.mock.patch.object(crypto, "_fetch_json", return_value={"bitcoin": {"usd": 42000}}):
            response = self.client.get("/api/crypto/price?coin=bitcoin")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["usd"], 42000)

    def test_price_endpoint_rejects_unsupported_coin(self):
        response = self.client.get("/api/crypto/price?coin=dogecoin")
        self.assertEqual(response.status_code, 400)

    def test_scenario_endpoint_never_leaks_the_outcome(self):
        response = self.client.get("/api/crypto/scenario?coin=bitcoin")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("lead_in", data)
        self.assertNotIn("outcome", data)  # the whole point -- no peeking

    def test_scenario_endpoint_includes_breakout_signal_but_not_continuation(self):
        response = self.client.get("/api/crypto/scenario?coin=bitcoin")
        data = response.get_json()
        self.assertIn(data["breakout_signal"], ("buy", "sell", "hold"))
        self.assertEqual(data["breakout_period"], crypto.DONCHIAN_PERIOD)
        self.assertNotIn("breakout_continued", data)  # would leak the outcome direction

    def test_decision_response_reveals_breakout_continuation(self):
        scenario = self.client.get("/api/crypto/scenario?coin=bitcoin").get_json()
        response = self.client.post(
            "/api/crypto/decision",
            json={"coin": "bitcoin", "event_timestamp": scenario["event_timestamp"], "choice": "hold"},
        )
        data = response.get_json()
        self.assertEqual(data["breakout_signal"], scenario["breakout_signal"])
        self.assertIn("breakout_continued", data)

    def test_breakout_stats_endpoint(self):
        response = self.client.get("/api/crypto/breakout-stats?coin=bitcoin")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["n_breakouts"], 2)
        self.assertEqual(data["coin"], "bitcoin")

    def test_breakout_stats_endpoint_rejects_unsupported_coin(self):
        response = self.client.get("/api/crypto/breakout-stats?coin=dogecoin")
        self.assertEqual(response.status_code, 400)

    def test_session_events_endpoint_returns_the_chronological_roadmap(self):
        response = self.client.get("/api/crypto/session-events?coin=bitcoin")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(len(data["rounds"]), 2)
        self.assertLess(data["rounds"][0]["event_timestamp"], data["rounds"][1]["event_timestamp"])

    def test_scenario_endpoint_accepts_a_specific_event_timestamp(self):
        roadmap = self.client.get("/api/crypto/session-events?coin=bitcoin").get_json()
        first_ts = roadmap["rounds"][0]["event_timestamp"]
        response = self.client.get(f"/api/crypto/scenario?coin=bitcoin&event_timestamp={first_ts}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["event_timestamp"], first_ts)

    def test_scenario_endpoint_404s_for_an_unknown_event_timestamp(self):
        response = self.client.get("/api/crypto/scenario?coin=bitcoin&event_timestamp=1")
        self.assertEqual(response.status_code, 404)

    def test_decision_response_includes_compounding_return_fields(self):
        scenario = self.client.get("/api/crypto/scenario?coin=bitcoin").get_json()
        response = self.client.post(
            "/api/crypto/decision",
            json={"coin": "bitcoin", "event_timestamp": scenario["event_timestamp"], "choice": "buy"},
        )
        data = response.get_json()
        self.assertIn("player_return_pct", data)
        self.assertIn("rule_return_pct", data)
        # "buy" always profits exactly as much as price moved, by definition.
        self.assertAlmostEqual(data["player_return_pct"], data["outcome_pct_change"], places=2)

    def test_chained_run_can_walk_the_full_roadmap_and_compound_returns(self):
        roadmap = self.client.get("/api/crypto/session-events?coin=bitcoin").get_json()["rounds"]
        equity = 1.0
        for round_info in roadmap:
            scenario = self.client.get(
                f"/api/crypto/scenario?coin=bitcoin&event_timestamp={round_info['event_timestamp']}"
            ).get_json()
            decision = self.client.post(
                "/api/crypto/decision",
                json={"coin": "bitcoin", "event_timestamp": scenario["event_timestamp"], "choice": "hold"},
            ).get_json()
            equity *= 1 + decision["player_return_pct"] / 100
        self.assertEqual(equity, 1.0)  # holding every round is always flat, by definition

    def test_full_scenario_to_decision_flow(self):
        scenario_res = self.client.get("/api/crypto/scenario?coin=bitcoin")
        scenario = scenario_res.get_json()

        decision_res = self.client.post(
            "/api/crypto/decision",
            json={"coin": "bitcoin", "event_timestamp": scenario["event_timestamp"], "choice": "buy"},
        )
        self.assertEqual(decision_res.status_code, 200)
        result = decision_res.get_json()
        self.assertEqual(result["choice"], "buy")
        self.assertIn("outcome", result)
        self.assertIn("outcome_pct_change", result)

    def test_decision_rejects_an_invalid_choice(self):
        scenario = self.client.get("/api/crypto/scenario?coin=bitcoin").get_json()
        response = self.client.post(
            "/api/crypto/decision",
            json={"coin": "bitcoin", "event_timestamp": scenario["event_timestamp"], "choice": "yolo"},
        )
        self.assertEqual(response.status_code, 400)

    def test_decision_404s_for_an_unknown_event_timestamp(self):
        response = self.client.post(
            "/api/crypto/decision",
            json={"coin": "bitcoin", "event_timestamp": 1, "choice": "hold"},
        )
        self.assertEqual(response.status_code, 404)

    def test_decision_is_logged_to_the_database(self):
        scenario = self.client.get("/api/crypto/scenario?coin=bitcoin").get_json()
        self.client.post(
            "/api/crypto/decision",
            json={"coin": "bitcoin", "event_timestamp": scenario["event_timestamp"], "choice": "sell"},
        )
        # Anonymous decisions log with user_id=None -- fetching by a real
        # signed-in user's id is covered separately below; this just
        # confirms the anonymous path doesn't error and something wrote.
        with db._conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT COUNT(*) FROM crypto_impulse_decisions WHERE event_timestamp = ?",
                (scenario["event_timestamp"],),
            )
            count = cur.fetchone()[0]
        self.assertGreaterEqual(count, 1)


class CryptoDbTests(unittest.TestCase):
    def test_record_and_get_round_trip(self):
        import uuid

        client = server.app.test_client()
        email = f"crypto-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = client.post("/api/auth/signup", json={"email": email, "password": "testpass123"})
        self.assertEqual(signup.status_code, 200)
        with client.session_transaction() as sess:
            uid = sess["user_id"]

        db.record_crypto_impulse_decision(
            user_id=uid, coin_id="bitcoin", event_timestamp=123456.0,
            direction="drop", pct_change=-9.5, choice="buy", outcome_pct_change=4.2,
        )
        decisions = db.get_crypto_impulse_decisions(uid)
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["choice"], "buy")
        self.assertEqual(decisions[0]["outcome_pct_change"], 4.2)


if __name__ == "__main__":
    unittest.main()
