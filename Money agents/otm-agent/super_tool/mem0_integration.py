"""
Mem0 Integration for Trading System
====================================
Provides persistent memory for personalized trading decisions.
"""

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from mem0 import Memory

logger = logging.getLogger(__name__)


class TradingMemory:
    """Memory layer for trading system using Mem0."""

    def __init__(
        self,
        llm_provider: str = "openai",
        llm_model: str = "gpt-4.1-nano",
        api_key: str = None,
        collection_name: str = "trading_memory",
    ):
        config = self._build_config(llm_provider, llm_model, api_key, collection_name)
        try:
            self.memory = Memory.from_config(config)
            self.initialized = True
            logger.info("TradingMemory initialized")
        except Exception as e:
            logger.warning(f"Mem0 init failed: {e}. Using null memory.")
            self.memory = None
            self.initialized = False

    def _build_config(
        self, llm_provider, llm_model, api_key, collection_name
    ) -> Dict[str, Any]:
        if api_key is None and llm_provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")

        config = {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "collection_name": collection_name,
                    "path": "./trading_memory_store",
                    "on_disk": True,
                },
            },
            "llm": {"provider": llm_provider, "config": {"model": llm_model}},
        }
        if api_key:
            config["llm"]["config"]["api_key"] = api_key
        return config

    def add(self, text: str, user_id: str = None, metadata: Dict[str, Any] = None):
        """Add memory"""
        if not self.initialized:
            return
        self.memory.add(text, user_id=user_id, metadata=metadata or {})

    def search(
        self, query: str, user_id: str = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Search memories"""
        if not self.initialized:
            return []
        try:
            return self.memory.search(query, user_id=user_id, limit=limit)
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    def get_all(self, user_id: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all memories"""
        if not self.initialized:
            return []
        try:
            return self.memory.get_all(user_id=user_id, limit=limit)
        except Exception as e:
            logger.error(f"Get all failed: {e}")
            return []

    def update(self, memory_id: str, data: str):
        """Update memory"""
        if not self.initialized:
            return
        self.memory.update(memory_id, data=data)

    def delete(self, memory_id: str):
        """Delete memory"""
        if not self.initialized:
            return
        self.memory.delete(memory_id)

    def history(self, memory_id: str) -> List[Dict[str, Any]]:
        """Get memory history"""
        if not self.initialized:
            return []
        return self.memory.history(memory_id)

    # High-level trading methods

    def update_trader_profile(
        self,
        user_id: str,
        risk_tolerance: str = None,
        max_position_pct: float = None,
        sectors: List[str] = None,
        style: str = None,
    ):
        """Update trader profile"""
        if not self.initialized:
            return
        if risk_tolerance:
            self.add(
                f"Risk tolerance: {risk_tolerance}",
                user_id=user_id,
                metadata={"category": "profile"},
            )
        if max_position_pct:
            self.add(
                f"Max position size: {int(max_position_pct * 100)}%",
                user_id=user_id,
                metadata={"category": "profile"},
            )
        if sectors:
            self.add(
                f"Preferred sectors: {', '.join(sectors)}",
                user_id=user_id,
                metadata={"category": "profile"},
            )
        if style:
            self.add(
                f"Trading style: {style}",
                user_id=user_id,
                metadata={"category": "profile"},
            )

    def get_trader_profile(self, user_id: str) -> Dict[str, Any]:
        """Get trader profile summary"""
        if not self.initialized:
            return {}
        memories = self.search("profile", user_id=user_id, limit=10)
        profile = {
            "user_id": user_id,
            "risk_tolerance": "medium",
            "sectors": [],
            "style": "swing",
        }
        for mem in memories:
            text = mem.get("data", "") if isinstance(mem, dict) else str(mem)
            if "risk" in text.lower():
                if "low" in text.lower():
                    profile["risk_tolerance"] = "low"
                elif "high" in text.lower():
                    profile["risk_tolerance"] = "high"
            if "sector" in text.lower():
                for s in ["tech", "healthcare", "finance", "energy"]:
                    if s in text.lower():
                        profile["sectors"].append(s)
            if "style" in text.lower():
                if "day" in text.lower():
                    profile["style"] = "day"
                elif "position" in text.lower():
                    profile["style"] = "position"
        return profile

    def record_trade(
        self,
        user_id: str,
        symbol: str,
        decision: str,
        size: float,
        entry: float,
        exit: float = None,
        pnl: float = None,
        reasoning: List[str] = None,
    ):
        """Record a trade"""
        if not self.initialized:
            return
        if pnl is not None:
            summary = f"Traded {symbol}: {decision}, P&L=${pnl:.2f}"
        else:
            summary = f"Opened {decision} on {symbol} at ${entry:.2f}"
        self.add(
            summary,
            user_id=user_id,
            metadata={"category": "trade", "symbol": symbol, "pnl": pnl},
        )
        if reasoning:
            for r in reasoning:
                self.add(
                    f"{symbol}: {r}",
                    user_id=user_id,
                    metadata={"category": "reasoning"},
                )

    def get_trade_history(
        self, user_id: str, symbol: str = None, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get trade history"""
        if not self.initialized:
            return []
        query = f"{symbol} trades" if symbol else "trades"
        return self.search(query, user_id=user_id, limit=limit)

    def get_trader_stats(self, user_id: str) -> Dict[str, Any]:
        """Get trader statistics"""
        if not self.initialized:
            return {}
        history = self.get_trade_history(user_id, limit=100)
        trades = [h for h in history if h.get("metadata", {}).get("pnl") is not None]
        if not trades:
            return {"total_trades": len(history)}
        wins = sum(1 for t in trades if t["metadata"]["pnl"] > 0)
        total_pnl = sum(t["metadata"]["pnl"] for t in trades)
        return {
            "total_trades": len(trades),
            "winning_trades": wins,
            "win_rate": round(wins / len(trades), 3) if trades else 0,
            "total_pnl": round(total_pnl, 2),
            "avg_pnl": round(total_pnl / len(trades), 2),
        }

    def store_pattern(
        self, name: str, description: str, success_rate: float, avg_return: float
    ):
        """Store trading pattern"""
        if not self.initialized:
            return
        self.add(
            f"Pattern '{name}': {description}. Success: {success_rate:.1%}, Avg: {avg_return:.1%}",
            user_id="system",
            metadata={"category": "pattern", "name": name},
        )

    def find_patterns(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Find patterns"""
        if not self.initialized:
            return []
        return self.search(query, user_id="system", limit=limit)


_memory_instance: Optional[TradingMemory] = None


def get_trading_memory() -> TradingMemory:
    """Get singleton TradingMemory"""
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = TradingMemory()
    return _memory_instance


if __name__ == "__main__":

    async def demo():
        print("=== Trading Memory Demo ===\n")
        memory = TradingMemory(llm_provider="openai")

        if not memory.initialized:
            print("Mem0 not initialized. Set OPENAI_API_KEY")
            return

        user = "demo_trader"

        # Profile
        memory.update_trader_profile(
            user, risk_tolerance="medium", max_position_pct=0.05, sectors=["tech"]
        )
        profile = memory.get_trader_profile(user)
        print(
            f"Profile: risk={profile.get('risk_tolerance')}, sectors={profile.get('sectors')}"
        )

        # Trades
        memory.record_trade(
            user, "AAPL", "BUY", 100, 150.0, 165.0, 1500.0, ["Strong earnings"]
        )
        memory.record_trade(user, "NVDA", "BUY", 50, 400.0, 380.0, -1000.0)

        # Stats
        stats = memory.get_trader_stats(user)
        print(
            f"Stats: {stats.get('total_trades')} trades, {stats.get('win_rate'):.1%} win rate, P&L=${stats.get('total_pnl')}"
        )

        # Patterns
        memory.store_pattern("Tech Breakout", "Buy on volume breakout", 0.68, 0.045)
        patterns = memory.find_patterns("tech breakout")
        print(f"Patterns found: {len(patterns)}")

        print("\n=== Demo Complete ===")

    asyncio.run(demo())
