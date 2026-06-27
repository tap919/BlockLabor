"""
Engram Integration for Trading Pattern Recognition
===================================================
O(1) pattern lookup using hash-based indexing.
"""

import hashlib
import json
import logging
import pickle
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class TradingPattern:
    """Trading pattern with metadata"""

    name: str
    pattern_hash: str
    market_sequence: List[Dict[str, Any]]
    outcome: Dict[str, Any]
    success_rate: float = 0.0
    avg_return: float = 0.0
    occurrences: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "pattern_hash": self.pattern_hash,
            "market_sequence": self.market_sequence,
            "outcome": self.outcome,
            "success_rate": self.success_rate,
            "avg_return": self.avg_return,
            "occurrences": self.occurrences,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TradingPattern":
        return cls(
            name=data["name"],
            pattern_hash=data["pattern_hash"],
            market_sequence=data["market_sequence"],
            outcome=data["outcome"],
            success_rate=data.get("success_rate", 0.0),
            avg_return=data.get("avg_return", 0.0),
            occurrences=data.get("occurrences", 1),
            created_at=datetime.fromisoformat(data["created_at"])
            if "created_at" in data
            else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"])
            if "updated_at" in data
            else datetime.now(),
        )


class TradingPatternMemory:
    """O(1) trading pattern lookup using hash-based indexing."""

    def __init__(self, storage_path: str = "./pattern_memory"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.patterns: Dict[str, TradingPattern] = {}
        self.index: Dict[str, List[str]] = {}
        self._load()
        logger.info(f"TradingPatternMemory initialized at {storage_path}")

    def _compute_hash(self, market_sequence: List[Dict[str, Any]]) -> str:
        quantized = []
        for state in market_sequence[-5:]:
            q_state = {
                "price_change": self._quantize(state.get("price_change", 0)),
                "volume_change": self._quantize(state.get("volume_change", 0)),
                "volatility": self._quantize(state.get("volatility", 0), bins=5),
                "trend": state.get("trend", "neutral")[:3],
            }
            quantized.append(q_state)
        sequence_str = json.dumps(quantized, sort_keys=True)
        return hashlib.sha256(sequence_str.encode()).hexdigest()[:16]

    def _quantize(self, value: float, bins: int = 10) -> int:
        normalized = (value + 1) / 2
        bin_size = 1.0 / bins
        return min(int(normalized / bin_size), bins - 1)

    def _categorize_pattern(self, market_sequence: List[Dict[str, Any]]) -> str:
        if not market_sequence:
            return "unknown"
        trends = [s.get("trend", "neutral") for s in market_sequence[-3:]]
        if all(t == "up" for t in trends):
            return "bullish"
        elif all(t == "down" for t in trends):
            return "bearish"
        elif any(t == "up" for t in trends) and any(t == "down" for t in trends):
            return "mixed"
        else:
            return "neutral"

    def store_pattern(
        self,
        name: str,
        market_sequence: List[Dict[str, Any]],
        outcome: Dict[str, Any],
        metadata: Dict[str, Any] = None,
    ) -> str:
        pattern_hash = self._compute_hash(market_sequence)
        category = self._categorize_pattern(market_sequence)

        if pattern_hash in self.patterns:
            pattern = self.patterns[pattern_hash]
            pattern.occurrences += 1
            pattern.updated_at = datetime.now()
            total = pattern.occurrences
            pattern.success_rate = (
                pattern.success_rate * (total - 1)
                + (1 if outcome.get("success") else 0)
            ) / total
            pattern.avg_return = (
                pattern.avg_return * (total - 1) + outcome.get("return", 0)
            ) / total
        else:
            pattern = TradingPattern(
                name=name,
                pattern_hash=pattern_hash,
                market_sequence=market_sequence,
                outcome=outcome,
                success_rate=1.0 if outcome.get("success") else 0.0,
                avg_return=outcome.get("return", 0.0),
            )
            self.patterns[pattern_hash] = pattern
            if category not in self.index:
                self.index[category] = []
            self.index[category].append(pattern_hash)

        self._save()
        return pattern_hash

    def find_similar(
        self, current_market_state: Dict[str, Any], lookback_days: int = 5
    ) -> Optional[Dict[str, Any]]:
        sequence = [current_market_state] * lookback_days
        pattern_hash = self._compute_hash(sequence)

        if pattern_hash in self.patterns:
            p = self.patterns[pattern_hash]
            return {
                "pattern_name": p.name,
                "historical_outcome": p.outcome,
                "success_rate": p.success_rate,
                "avg_return": p.avg_return,
                "occurrences": p.occurrences,
                "exact_match": True,
            }

        category = self._categorize_pattern(sequence)
        if category in self.index and self.index[category]:
            p = self.patterns[self.index[category][0]]
            return {
                "pattern_name": p.name,
                "historical_outcome": p.outcome,
                "success_rate": p.success_rate,
                "avg_return": p.avg_return,
                "occurrences": p.occurrences,
                "exact_match": False,
                "category_match": category,
            }
        return None

    def find_by_category(self, category: str, limit: int = 10) -> List[Dict[str, Any]]:
        if category not in self.index:
            return []
        hashes = self.index[category][:limit]
        return [
            {
                "name": self.patterns[h].name,
                "success_rate": self.patterns[h].success_rate,
                "avg_return": self.patterns[h].avg_return,
                "occurrences": self.patterns[h].occurrences,
            }
            for h in hashes
        ]

    def get_all_patterns(self) -> List[Dict[str, Any]]:
        return [p.to_dict() for p in self.patterns.values()]

    def _save(self):
        """Save patterns to disk using JSON (safe)"""
        try:
            data = {
                "patterns": {k: v.to_dict() for k, v in self.patterns.items()},
                "index": self.index,
            }
            with open(self.storage_path / "patterns.json", "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving: {e}")

    def _load(self):
        """Load patterns from disk using JSON (safe)"""
        try:
            path = self.storage_path / "patterns.json"
            if path.exists():
                with open(path, "r") as f:
                    data = json.load(f)
                self.patterns = {
                    k: TradingPattern.from_dict(v)
                    for k, v in data.get("patterns", {}).items()
                }
                self.index = data.get("index", {})
                logger.info(f"Loaded {len(self.patterns)} patterns")
        except Exception as e:
            logger.error(f"Error loading: {e}")


if __name__ == "__main__":

    async def demo():
        print("=== Engram Pattern Memory Demo ===\n")
        memory = TradingPatternMemory(storage_path="./demo_patterns")

        # Store patterns
        print("1. Storing patterns...")
        memory.store_pattern(
            name="bull_flag",
            market_sequence=[
                {
                    "trend": "up",
                    "price_change": 0.02,
                    "volume_change": 0.15,
                    "volatility": 0.2,
                }
            ],
            outcome={"success": True, "return": 0.045},
        )
        memory.store_pattern(
            name="head_shoulders",
            market_sequence=[
                {
                    "trend": "down",
                    "price_change": -0.02,
                    "volume_change": 0.05,
                    "volatility": 0.25,
                }
            ],
            outcome={"success": True, "return": 0.038},
        )

        # Find similar
        print("\n2. Finding patterns...")
        match = memory.find_similar(
            {
                "trend": "up",
                "price_change": 0.02,
                "volume_change": 0.15,
                "volatility": 0.2,
            }
        )
        if match:
            print(
                f"   Match: {match['pattern_name']} (success: {match['success_rate']:.1%}, return: {match['avg_return']:.1%})"
            )

        # Stats
        print("\n3. All patterns:")
        for p in memory.get_all_patterns():
            print(
                f"   - {p['name']}: {p['occurrences']}x, {p['success_rate']:.1%} success"
            )

        print("\n=== Demo Complete ===")

    import asyncio

    asyncio.run(demo())
