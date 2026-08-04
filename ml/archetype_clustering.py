"""
Empirical clustering of quiz-response (or, currently, synthetic-population
— see archetype_synthetic.py) six-axis profiles: k-means swept across a
range of k, compared against agglomerative (hierarchical) clustering,
scored by silhouette rather than picked by assumption, then checked
against fbm.js's 11 hand-defined archetypes to see where empirical
structure agrees or disagrees with the hand-tuned one.
"""

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


def sweep_kmeans(X, k_range=range(2, 16), random_state=42):
    """Returns a DataFrame of k, silhouette_score, inertia — silhouette is
    the deciding metric (bounded, comparable across k; inertia trivially
    decreases with k so it can't rank cluster COUNTS against each other)."""
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    rows = []
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=random_state, n_init=10)
        labels = km.fit_predict(X_scaled)
        score = silhouette_score(X_scaled, labels)
        rows.append({"k": k, "silhouette": score, "inertia": km.inertia_})
    return pd.DataFrame(rows)


def best_k(sweep_df):
    return int(sweep_df.loc[sweep_df["silhouette"].idxmax(), "k"])


def run_kmeans(X, k, random_state=42):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    km = KMeans(n_clusters=k, random_state=random_state, n_init=10)
    labels = km.fit_predict(X_scaled)
    # Cluster centers back in original (unscaled) axis units, since that's
    # what's comparable to fbm.js's ARCHETYPE_PROFILES coordinates.
    centers_original = scaler.inverse_transform(km.cluster_centers_)
    return labels, centers_original, silhouette_score(X_scaled, labels)


def run_hierarchical(X, k):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    model = AgglomerativeClustering(n_clusters=k)
    labels = model.fit_predict(X_scaled)
    centers = np.array([X.to_numpy()[labels == c].mean(axis=0) for c in range(k)])
    return labels, centers, silhouette_score(X_scaled, labels)


def match_clusters_to_archetypes(centers, axis_keys, archetype_profiles):
    """Nearest-neighbor match: for each empirical cluster center, which
    hand-defined archetype is it closest to? Returns a list of (cluster_idx,
    nearest_archetype, distance). Flags worth checking downstream: two
    clusters matching the same archetype (that archetype may not be
    empirically distinguishable from something nearby), or an archetype no
    cluster matches at all (nothing empirical corresponds to it)."""
    names = list(archetype_profiles.keys())
    targets = np.array([[archetype_profiles[name][a] for a in axis_keys] for name in names])

    matches = []
    for i, center in enumerate(centers):
        dists = np.linalg.norm(targets - center, axis=1)
        best = int(np.argmin(dists))
        matches.append((i, names[best], float(dists[best])))
    return matches
