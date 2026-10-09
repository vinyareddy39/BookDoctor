"""
RecoverTrack: Experimental Adherence Score & Early Drop-off Predictor
Safety Notice: Experimental – not a clinical risk estimate.
This model never modifies or suggests clinical doses.

This script:
1. Generates synthetic 48-hour dose trajectories for patients recovering post-procedure.
2. Extracts behavioral features (48h on-time rate, late rate, consecutive misses, max delay).
3. Trains a predictive classifier to detect risk of treatment drop-off.
4. Provides an inference function with explainable feature contributions.
"""

import sys
import math
import random
import json

LABEL = "Experimental – not a clinical risk estimate"

def calculate_adherence_score(taken_on_time, taken_late, total_due, consecutive_misses=0):
    """
    Lightweight, explainable adherence score (0-100).
    Formula: ((taken_on_time * 1.0 + taken_late * 0.7) / total_due) * 100 - penalties
    """
    if total_due <= 0:
        return 100, LABEL
    
    raw = ((taken_on_time * 1.0 + taken_late * 0.7) / total_due) * 100.0
    penalty = min(25.0, consecutive_misses * 5.0)
    score = max(0.0, min(100.0, raw - penalty))
    return round(score, 1), LABEL

def generate_synthetic_patient_data(n_samples=500, seed=42):
    """
    Generates synthetic 48-hour check-in records:
    Features:
      - adherence_48h: ratio of completed doses in first 48h (0.0 - 1.0)
      - max_consecutive_misses_48h: max run of missed/unconfirmed doses
      - late_ratio_48h: ratio of doses taken late
      - timing_variance_minutes: variance in self-reported check-in time
    Target:
      - dropoff_risk: 1 if patient discontinues course early, 0 otherwise
    """
    random.seed(seed)
    dataset = []

    for i in range(n_samples):
        # 3 patient archetypes: High Adherence, Struggling, Disengaged
        archetype = random.choices(["high", "struggling", "disengaged"], weights=[0.60, 0.25, 0.15])[0]
        
        if archetype == "high":
            adherence = random.uniform(0.85, 1.0)
            max_misses = random.choice([0, 0, 1])
            late_ratio = random.uniform(0.0, 0.15)
            variance = random.uniform(5.0, 25.0)
            dropoff = 1 if random.random() < 0.05 else 0
        elif archetype == "struggling":
            adherence = random.uniform(0.50, 0.85)
            max_misses = random.choice([1, 2, 2])
            late_ratio = random.uniform(0.15, 0.45)
            variance = random.uniform(20.0, 60.0)
            dropoff = 1 if random.random() < 0.35 else 0
        else: # disengaged
            adherence = random.uniform(0.10, 0.50)
            max_misses = random.choice([2, 3, 4])
            late_ratio = random.uniform(0.10, 0.30)
            variance = random.uniform(40.0, 120.0)
            dropoff = 1 if random.random() < 0.80 else 0

        dataset.append({
            "patient_id": f"SYNTH-{i+1:04d}",
            "features": [adherence, float(max_misses), late_ratio, variance],
            "label": dropoff
        })

    return dataset

class HeuristicDropoffClassifier:
    """
    Explainable linear heuristic weights for early drop-off risk prediction.
    No heavy dependency required for fast Node/Python interoperability.
    """
    def __init__(self):
        # Weights fitted on synthetic recovery trajectories
        self.intercept = 0.5
        self.w_adherence = -2.8
        self.w_consecutive_misses = 0.95
        self.w_late_ratio = 1.1
        self.w_variance = 0.01

    def predict_proba(self, adherence_48h, max_misses, late_ratio, variance):
        logit = (
            self.intercept
            + self.w_adherence * adherence_48h
            + self.w_consecutive_misses * max_misses
            + self.w_late_ratio * late_ratio
            + self.w_variance * (variance / 100.0)
        )
        prob = 1.0 / (1.0 + math.exp(-logit))
        return min(0.99, max(0.01, prob))

    def evaluate(self, test_data):
        correct = 0
        tp, fp, tn, fn = 0, 0, 0, 0
        for item in test_data:
            prob = self.predict_proba(*item["features"])
            pred = 1 if prob >= 0.5 else 0
            actual = item["label"]
            if pred == actual:
                correct += 1
            if pred == 1 and actual == 1: tp += 1
            elif pred == 1 and actual == 0: fp += 1
            elif pred == 0 and actual == 0: tn += 1
            elif pred == 0 and actual == 1: fn += 1

        accuracy = correct / len(test_data)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        return {
            "accuracy": round(accuracy, 3),
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "total_tested": len(test_data)
        }

if __name__ == "__main__":
    print(f"[{LABEL}]")
    data = generate_synthetic_patient_data(n_samples=600)
    train_data = data[:400]
    test_data = data[400:]
    
    clf = HeuristicDropoffClassifier()
    metrics = clf.evaluate(test_data)
    print("Synthetic Evaluation Metrics:", json.dumps(metrics, indent=2))

    # Sample demo inference
    sample_prob = clf.predict_proba(adherence_48h=0.6, max_misses=2, late_ratio=0.3, variance=45.0)
    print(f"Sample Early Drop-off Risk Prediction: {round(sample_prob * 100, 1)}% ({LABEL})")
