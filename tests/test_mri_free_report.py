"""
Tests for the free Financial MRI builder.

The central property under test is refusal: every section must return None
when its evidence is too thin, rather than a plausible-looking default. That
is the whole basis of the report's credibility, so it gets more coverage here
than the happy paths do.
"""
import mri_free_report as m


def _d(**kw):
    base = {
        "predicted": 0, "actual": 0, "matched": True, "timed": False,
        "net_worth_delta": 0, "predicted_net_worth_delta": 0,
        "scenario": "s", "choice": "c", "surface": None, "principle": None,
    }
    base.update(kw)
    return base


# --------------------------------------------------------------- gap

def test_gap_is_none_below_minimum_evidence():
    decisions = [_d(predicted_net_worth_delta=500, net_worth_delta=0)] * 2
    assert m.prediction_gap(decisions) is None


def test_gap_ignores_decisions_without_a_prediction():
    # Four decisions, but only two carry a prediction: still under the bar.
    decisions = [
        _d(predicted_net_worth_delta=500, net_worth_delta=0),
        _d(predicted_net_worth_delta=500, net_worth_delta=0),
        _d(predicted=None, predicted_net_worth_delta=None),
        _d(predicted=None, predicted_net_worth_delta=None),
    ]
    assert m.prediction_gap(decisions) is None


def test_gap_sums_difference_and_finds_biggest_miss():
    decisions = [
        _d(predicted_net_worth_delta=0, net_worth_delta=-2100, choice="Buy now"),
        _d(predicted_net_worth_delta=500, net_worth_delta=500),
        _d(predicted_net_worth_delta=100, net_worth_delta=-800),
    ]
    gap = m.prediction_gap(decisions)
    assert gap["total"] == 3000
    assert gap["decision_count"] == 3
    assert gap["biggest"]["amount"] == 2100
    assert gap["biggest"]["choice"] == "Buy now"


def test_gap_is_none_when_actual_choices_did_better():
    """No gap to report when they outperformed their own predictions.
    Reporting one anyway would invert the finding."""
    decisions = [
        _d(predicted_net_worth_delta=0, net_worth_delta=900),
        _d(predicted_net_worth_delta=0, net_worth_delta=400),
        _d(predicted_net_worth_delta=0, net_worth_delta=200),
    ]
    assert m.prediction_gap(decisions) is None


# --------------------------------------------------------------- split

def test_split_needs_both_groups_populated():
    only_timed = [_d(timed=True)] * 6
    assert m.time_pressure_split(only_timed) is None


def test_split_flags_a_real_pattern():
    decisions = (
        [_d(timed=False, matched=True)] * 6
        + [_d(timed=False, matched=False)]
        + [_d(timed=True, matched=True)] * 3
        + [_d(timed=True, matched=False)] * 5
    )
    split = m.time_pressure_split(decisions)
    assert split["untimed"] == {"total": 7, "kept": 6}
    assert split["timed"] == {"total": 8, "kept": 3}
    assert split["is_pattern"] is True


def test_split_does_not_claim_a_pattern_when_groups_are_alike():
    decisions = (
        [_d(timed=False, matched=True)] * 3 + [_d(timed=False, matched=False)]
        + [_d(timed=True, matched=True)] * 3 + [_d(timed=True, matched=False)]
    )
    assert m.time_pressure_split(decisions)["is_pattern"] is False


# --------------------------------------------------------------- twin

def test_twin_is_none_below_minimum_and_counts_rather_than_scores():
    assert m.twin_match([_d()] * 3) is None
    twin = m.twin_match([_d(matched=True)] * 3 + [_d(matched=False)])
    # Deliberately a count, not a percentage.
    assert twin == {"matched": 3, "total": 4}


# --------------------------------------------------------------- confidence

def test_confidence_is_capped_and_admits_weakest_axes():
    profile = {
        "impulse_regulation": 42, "risk_disposition": 68,
        "temporal_orientation": 84, "financial_attentiveness": 61,
        "financial_self_efficacy": 73, "prosocial_orientation": 51,
    }
    ranking = [{"slug": "a", "closeness": 100}, {"slug": "b", "closeness": 60}]
    conf = m.confidence(profile, [_d()] * 40, ranking)
    assert conf["score"] <= 96, "a behavioural model should never report certainty"
    # Distance from the neutral midpoint: Giving 1, Impulse 8, Attention 11,
    # Risk 18, Confidence 23, Time 34. The two nearest neutral carry the least
    # signal and are what the report should admit to being unsure about.
    assert set(conf["weakest"]) == {"Giving", "Impulse"}


def test_confidence_falls_with_thin_evidence():
    profile = {k: 50 for k in m.AXIS_KEYS}
    ranking = [{"slug": "a", "closeness": 90}, {"slug": "b", "closeness": 88}]
    thin = m.confidence(profile, [_d()], ranking)
    thick = m.confidence(profile, [_d()] * 15, ranking)
    assert thin["score"] < thick["score"]


# --------------------------------------------------------------- ranking

def test_archetype_ranking_is_sorted_and_covers_every_archetype():
    profile = {
        "impulse_regulation": 60, "risk_disposition": 65,
        "temporal_orientation": 90, "financial_attentiveness": 75,
        "financial_self_efficacy": 75, "prosocial_orientation": 40,
    }
    ranked = m.archetype_ranking(profile)
    assert len(ranked) == 11
    assert ranked[0]["slug"] == "ambitious_builder"
    assert all(
        ranked[i]["closeness"] >= ranked[i + 1]["closeness"]
        for i in range(len(ranked) - 1)
    )


# --------------------------------------------------------------- assembly

def test_build_free_report_degrades_without_erroring_on_no_decisions():
    profile = {k: 50 for k in m.AXIS_KEYS}
    report = m.build_free_report(profile, "steady_saver", m.archetype_ranking(profile), [])
    assert report["prediction_gap"] is None
    assert report["time_pressure"] is None
    assert report["twin"] is None
    assert report["decision_count"] == 0
    # The parts derivable from the quiz alone still populate.
    assert report["archetype"] == "steady_saver"
    assert len(report["profile"]) == 6
