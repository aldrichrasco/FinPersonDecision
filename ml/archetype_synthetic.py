"""
SYNTHETIC archetype-profile population — not real quiz responses.

Same honesty pattern as ml/synthetic.py: checked against the real database
(ml/archetype_data.py), only 101 signed-in users have ever saved a profile,
covering 4 of the 11 archetypes, with one class down to a single example —
not trainable, and not enough to cluster meaningfully either.

What this generates instead: samples drawn from a Gaussian around EACH of
fbm.js's 11 real, currently-shipping ARCHETYPE_PROFILES target vectors
(ml/archetype_profiles.json, dumped straight from fbm.js — not
hand-retyped), plus axis noise and clipping to the real 0-100 range. This
is a genuinely useful synthetic question, not just a stand-in for missing
data: IF real users clustered around these hand-designed centroids the way
the archetype system assumes, would empirical clustering (k-means/
hierarchical) actually recover 11 separate groups, or would some merge?
That's answerable without a single real quiz response, and it's exactly
what ml/archetype_clustering.py checks.
"""

import json
import os

import numpy as np
import pandas as pd

_PROFILES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "archetype_profiles.json")


def load_archetype_profiles():
    if not os.path.exists(_PROFILES_PATH):
        raise FileNotFoundError(
            f"{_PROFILES_PATH} not found — run `node ml/dump_archetype_profiles.js` first "
            "and commit the result."
        )
    with open(_PROFILES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data["axis_keys"], data["archetype_profiles"]


def synthetic_archetype_dataset(n_per_archetype=150, axis_noise_std=13, seed=44):
    """axis_noise_std=13 is a deliberate choice, not a default library
    value: fbm.js's own archetype coordinates are typically 20-40 points
    apart on the axes that distinguish a given pair (see
    ARCHETYPE_PROFILES) — noise much larger than that would make the
    generated clusters overlap so much that even the *design* wouldn't be
    separable, which would test noise robustness, not the clustering
    question this module exists to answer."""
    axis_keys, profiles = load_archetype_profiles()
    rng = np.random.default_rng(seed)

    rows = []
    for archetype, target in profiles.items():
        target_vec = np.array([target[a] for a in axis_keys])
        samples = rng.normal(loc=target_vec, scale=axis_noise_std, size=(n_per_archetype, len(axis_keys)))
        samples = np.clip(samples, 0, 100)
        for row in samples:
            record = dict(zip(axis_keys, row.tolist()))
            record["archetype"] = archetype
            rows.append(record)

    df = pd.DataFrame(rows)
    return df[axis_keys + ["archetype"]]
