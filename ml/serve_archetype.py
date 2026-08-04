"""
Loads the most recently trained archetype classifier artifact
(ml/artifacts/, written by ml.train_archetype_model) and serves
predictions — the "exported model artifact the app can call" half of the
PRD's serving requirement (the other option was a live API endpoint; see
this module's docstring below for why that wasn't built instead).

NOT wired into server.py. fbm.js's matchArchetype() remains the real,
production archetype matcher. This module exists so the capability —
"the app can call the trained classifier" — is real and testable, without
adding a live HTTP route that would serve predictions from a model trained
on synthetic data as though they meant something. Add a route calling
predict() below once ml.train_archetype_model has real data to train on
(see ML_ENGINEERING_NOTES.md §3's product-wiring note).
"""

import glob
import json
import os

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")


class NoArtifact(Exception):
    """Raised when ml.train_archetype_model hasn't been run yet."""


def latest_artifact():
    """Returns (model_path, metadata_dict) for the most recently trained
    classifier, by the timestamp embedded in its filename."""
    metas = sorted(glob.glob(os.path.join(ARTIFACT_DIR, "archetype_rf_*.json")))
    if not metas:
        raise NoArtifact(f"No trained model in {ARTIFACT_DIR} — run `python -m ml.train_archetype_model` first.")
    with open(metas[-1], encoding="utf-8") as f:
        metadata = json.load(f)
    model_path = os.path.join(ARTIFACT_DIR, metadata["model_path"])
    return model_path, metadata


def predict(profile: dict):
    """profile: dict of the six axis scores (fbm.js's AXIS_KEYS). Returns
    {"archetype": str, "probabilities": {archetype: float, ...}, "model_metadata": {...}}."""
    import joblib

    model_path, metadata = latest_artifact()
    model = joblib.load(model_path)

    axis_keys = metadata["axis_keys"]
    missing = [a for a in axis_keys if a not in profile]
    if missing:
        raise ValueError(f"profile missing axes: {missing}")
    x = [[profile[a] for a in axis_keys]]

    predicted = model.predict(x)[0]
    proba = model.predict_proba(x)[0]
    probabilities = dict(zip(model.classes_.tolist(), proba.tolist()))

    return {"archetype": predicted, "probabilities": probabilities, "model_metadata": metadata}
