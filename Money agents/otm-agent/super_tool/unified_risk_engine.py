"""
Unified Risk Management Engine
==============================
Combines risk management from:
- Sports-Steve: Kelly criterion, multi-broker exposure tracking
- TradingAgents: Portfolio risk, volatility assessment
- Official Sub-Team: RiskAssessorAgent for deterministic analysis

This engine provides consistent risk calculations across all trading
and betting activities in the financial automation system.
"""

import asyncio
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class StrategyType(Enum):
    BETTING = "betting"
    TRADING = "trading"
    ARBITRAGE = "arbitrage"
    MARKET_MAKING = "market_making"


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


@dataclass
class RiskMetrics:
    """Unified risk metrics returned by all calculations"""

    position_size: float = 0.0
    risk_level: RiskLevel = RiskLevel.LOW
    volatility: float = 0.0
    edge: float = 0.0
    expected_return: float = 0.0
    max_loss: float = 0.0
    sharpe_ratio: float = 0.0
    kelly_fraction: float = 0.0
    exposure_pct: float = 0.0
    confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_size": self.position_size,
            "risk_level": self.risk_level.value,
            "volatility": self.volatility,
            "edge": self.edge,
            "expected_return": self.expected_return,
            "max_loss": self.max_loss,
            "sharpe_ratio": self.sharpe_ratio,
            "kelly_fraction": self.kelly_fraction,
            "exposure_pct": self.exposure_pct,
            "confidence": self.confidence,
            "metadata": self.metadata,
        }


@dataclass
class Position:
    """Represents an open position for exposure tracking"""

    id: str
    strategy_type: StrategyType
    symbol: str
    size: float
    entry_price: float
    current_price: float
    pnl: float = 0.0
    opened_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


class UnifiedRiskEngine:
    """
    Central risk management hub for all financial activities.
    """

    def __init__(
        self,
        bankroll: float = 10_000.0,
        max_daily_loss_pct: float = 0.05,
        max_exposure_pct: float = 0.20,
        kelly_fraction: float = 0.25,
        volatility_lookback: int = 20,
    ):
        self.bankroll = bankroll
        self.max_daily_loss_pct = max_daily_loss_pct
        self.max_exposure_pct = max_exposure_pct
        self.kelly_fraction = kelly_fraction
        self.volatility_lookback = volatility_lookback

        self._positions: Dict[str, Position] = {}
        self._daily_pnl: float = 0.0
        self._is_cooling_down: bool = False
        self._trade_history: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

        logger.info(
            "UnifiedRiskEngine initialized | bankroll=%.2f | "
            "max_daily_loss=%.0f%% | max_exposure=%.0f%% | kelly_fraction=%.2f",
            bankroll,
            max_daily_loss_pct * 100,
            max_exposure_pct * 100,
            kelly_fraction,
        )

    def kelly_stake(self, win_probability: float, decimal_odds: float) -> float:
        """Calculate stake using fractional Kelly criterion."""
        if not (0 < win_probability < 1) or decimal_odds <= 1.0:
            return 0.0

        b = decimal_odds - 1.0
        q = 1.0 - win_probability
        kelly_full = (b * win_probability - q) / b

        if kelly_full <= 0:
            return 0.0

        fractional = kelly_full * self.kelly_fraction
        max_stake = self.bankroll * self.max_exposure_pct
        stake = min(fractional * self.bankroll, max_stake)

        return round(stake, 2)

    def volatility_adjusted_position(
        self,
        volatility: float,
        target_risk: float = 0.02,
        min_volatility: float = 0.05,
        max_volatility: float = 1.0,
    ) -> float:
        """Calculate position size based on volatility targeting."""
        vol = max(min_volatility, min(max_volatility, volatility))
        position_fraction = target_risk / vol
        max_position = self.bankroll * self.max_exposure_pct
        position = min(position_fraction * self.bankroll, max_position)
        return round(position, 2)

    def assess_risk_level(
        self,
        volatility: float,
        edge: float,
        market_conditions: Optional[Dict[str, Any]] = None,
    ) -> RiskLevel:
        """Assess overall risk level using deterministic rules."""
        if volatility < 0.15:
            base_risk = RiskLevel.LOW
        elif volatility < 0.30:
            base_risk = RiskLevel.MEDIUM
        elif volatility < 0.50:
            base_risk = RiskLevel.HIGH
        else:
            base_risk = RiskLevel.EXTREME

        if edge < -0.10:
            risk_values = [
                RiskLevel.LOW,
                RiskLevel.MEDIUM,
                RiskLevel.HIGH,
                RiskLevel.EXTREME,
            ]
            current_idx = risk_values.index(base_risk)
            base_risk = risk_values[min(current_idx + 1, 3)]

        if market_conditions and market_conditions.get("high_uncertainty", False):
            if base_risk != RiskLevel.EXTREME:
                risk_values = [
                    RiskLevel.LOW,
                    RiskLevel.MEDIUM,
                    RiskLevel.HIGH,
                    RiskLevel.EXTREME,
                ]
                current_idx = risk_values.index(base_risk)
                base_risk = risk_values[min(current_idx + 1, 3)]

        return base_risk

    def calculate_position_size(
        self,
        strategy_type: StrategyType,
        edge: float,
        volatility: float,
        odds: Optional[float] = None,
        win_probability: Optional[float] = None,
        confidence: Optional[float] = None,
    ) -> RiskMetrics:
        """Calculate optimal position size based on strategy type."""
        if self._is_cooling_down:
            return RiskMetrics(
                position_size=0.0,
                risk_level=RiskLevel.EXTREME,
                metadata={"reason": "cool_down_active"},
            )

        if strategy_type == StrategyType.BETTING and win_probability and odds:
            position = self.kelly_stake(win_probability, odds)
            kelly_fraction = self.kelly_fraction
        else:
            position = self.volatility_adjusted_position(volatility)
            kelly_fraction = 0.0

        if confidence:
            position *= confidence

        risk_level = self.assess_risk_level(volatility, edge)
        max_loss = position * (1.0 if strategy_type == StrategyType.BETTING else 0.10)
        expected_return = position * edge

        exposure = self.get_exposure()
        exposure_pct = exposure.get("exposure_pct", 0.0)

        if (
            exposure_pct + (position / self.bankroll * 100)
            > self.max_exposure_pct * 100
        ):
            position = 0.0
            risk_level = RiskLevel.EXTREME

        return RiskMetrics(
            position_size=position,
            risk_level=risk_level,
            volatility=volatility,
            edge=edge,
            expected_return=expected_return,
            max_loss=max_loss,
            sharpe_ratio=edge / volatility if volatility > 0 else 0.0,
            kelly_fraction=kelly_fraction,
            exposure_pct=exposure_pct,
            confidence=confidence or 0.5,
            metadata={
                "strategy_type": strategy_type.value,
                "bankroll": self.bankroll,
                "calculated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def get_exposure(self) -> Dict[str, Any]:
        """Get current exposure broken down by strategy and symbol."""
        open_positions = [p for p in self._positions.values() if p.pnl == 0.0]
        total_exposure = sum(p.size * p.current_price for p in open_positions)

        by_strategy: Dict[str, float] = {}
        by_symbol: Dict[str, float] = {}

        for pos in open_positions:
            strategy_key = pos.strategy_type.value
            by_strategy[strategy_key] = (
                by_strategy.get(strategy_key, 0.0) + pos.size * pos.current_price
            )
            by_symbol[pos.symbol] = (
                by_symbol.get(pos.symbol, 0.0) + pos.size * pos.current_price
            )

        return {
            "total_exposure": round(total_exposure, 2),
            "position_count": len(open_positions),
            "by_strategy": by_strategy,
            "by_symbol": by_symbol,
            "exposure_pct": round(total_exposure / self.bankroll * 100, 2)
            if self.bankroll > 0
            else 0.0,
            "available_capital": round(self.bankroll - total_exposure, 2),
        }

    async def add_position(
        self,
        position_id: str,
        strategy_type: StrategyType,
        symbol: str,
        size: float,
        entry_price: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Position:
        """Record a new position for tracking"""
        position = Position(
            id=position_id,
            strategy_type=strategy_type,
            symbol=symbol,
            size=size,
            entry_price=entry_price,
            current_price=entry_price,
            metadata=metadata or {},
        )

        async with self._lock:
            self._positions[position_id] = position

        return position

    async def update_position_price(
        self, position_id: str, current_price: float
    ) -> float:
        """Update current price and calculate PnL"""
        async with self._lock:
            position = self._positions.get(position_id)
            if not position:
                return 0.0

            position.current_price = current_price
            position.pnl = (current_price - position.entry_price) * position.size

        return position.pnl

    async def close_position(self, position_id: str, exit_price: float) -> float:
        """Close a position and update bankroll"""
        async with self._lock:
            position = self._positions.pop(position_id, None)
            if not position:
                return 0.0

            pnl = (exit_price - position.entry_price) * position.size
            self.bankroll += pnl
            self._daily_pnl += pnl

            self._trade_history.append(
                {
                    "position_id": position_id,
                    "symbol": position.symbol,
                    "strategy": position.strategy_type.value,
                    "entry_price": position.entry_price,
                    "exit_price": exit_price,
                    "pnl": pnl,
                    "closed_at": datetime.now(timezone.utc).isoformat(),
                }
            )

            self._check_stop_loss()

        return pnl

    def _check_stop_loss(self) -> bool:
        """Check if daily loss limit breached and trigger cool-down"""
        if self._is_cooling_down:
            return True

        loss_limit = self.bankroll * self.max_daily_loss_pct
        if self._daily_pnl <= -loss_limit:
            self._is_cooling_down = True
            return True
        return False

    def reset_daily_limits(self) -> None:
        """Reset daily PnL and cool-down"""
        self._daily_pnl = 0.0
        self._is_cooling_down = False

    def get_risk_report(self) -> Dict[str, Any]:
        """Generate comprehensive risk report"""
        exposure = self.get_exposure()
        total_pnl = sum(p.pnl for p in self._positions.values())
        winning_positions = sum(1 for p in self._positions.values() if p.pnl > 0)
        total_positions = len(self._positions)
        win_rate = winning_positions / total_positions if total_positions > 0 else 0.0

        return {
            "bankroll": round(self.bankroll, 2),
            "daily_pnl": round(self._daily_pnl, 2),
            "is_cooling_down": self._is_cooling_down,
            "exposure": exposure,
            "portfolio_metrics": {
                "total_positions": total_positions,
                "winning_positions": winning_positions,
                "win_rate": round(win_rate, 3),
                "total_unrealized_pnl": round(total_pnl, 2),
            },
            "limits": {
                "max_daily_loss_pct": self.max_daily_loss_pct,
                "max_exposure_pct": self.max_exposure_pct,
                "kelly_fraction": self.kelly_fraction,
            },
            "trade_count": len(self._trade_history),
        }

    def get_trade_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent trade history"""
        return self._trade_history[-limit:]


def create_risk_engine_for_draymond(
    config: Optional[Dict[str, Any]] = None,
) -> UnifiedRiskEngine:
    """Factory function to create risk engine with Draymond-compatible config."""
    default_config = {
        "bankroll": 10000.0,
        "max_daily_loss_pct": 0.05,
        "max_exposure_pct": 0.20,
        "kelly_fraction": 0.25,
    }

    if config:
        default_config.update(config)

    return UnifiedRiskEngine(
        bankroll=default_config["bankroll"],
        max_daily_loss_pct=default_config["max_daily_loss_pct"],
        max_exposure_pct=default_config["max_exposure_pct"],
        kelly_fraction=default_config["kelly_fraction"],
    )


if __name__ == "__main__":

    async def demo():
        engine = UnifiedRiskEngine(bankroll=10000)

        metrics = engine.calculate_position_size(
            strategy_type=StrategyType.BETTING,
            edge=0.10,
            volatility=0.25,
            odds=2.5,
            win_probability=0.45,
            confidence=0.8,
        )
        print(
            f"Betting position: ${metrics.position_size:.2f} (Risk: {metrics.risk_level.value})"
        )

        metrics = engine.calculate_position_size(
            strategy_type=StrategyType.TRADING,
            edge=0.05,
            volatility=0.30,
            confidence=0.7,
        )
        print(
            f"Trading position: ${metrics.position_size:.2f} (Risk: {metrics.risk_level.value})"
        )

        report = engine.get_risk_report()
        print(
            f"\nRisk Report: Bankroll=${report['bankroll']:.2f}, Exposure={report['exposure']['exposure_pct']:.1f}%"
        )

    asyncio.run(demo())
