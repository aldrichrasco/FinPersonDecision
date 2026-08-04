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
