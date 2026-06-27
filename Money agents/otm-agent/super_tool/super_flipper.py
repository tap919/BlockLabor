import asyncio
import os
import sys

import alpaca_trade_api as tradeapi

# Assume sub_agents.py is imported or classes are available
from sub_agents import create_sub_team
from tradingagents.agent import TradingAgent  # Assuming from TradingAgents-main
from tradingagents.strategy import MovingAverageStrategy  # Example strategy

from draymond_agent import DraymondAgent  # Assuming from draymond_agent.py


async def validate_live_flip(asset, amount, hours):
    """Validate current market conditions using live data (no historical backtest)."""
    api_key = os.getenv("ALPACA_API_KEY")
    secret_key = os.getenv("ALPACA_SECRET_KEY")
    if not (api_key and secret_key):
        raise ValueError(
            "ALPACA_API_KEY and ALPACA_SECRET_KEY must be set in environment variables"
        )

    alpaca = tradeapi.REST(
        api_key,
        secret_key,
        base_url="https://api.alpaca.markets",  # Live trading URL
        api_version="v2",
    )

    # Get latest bar for quick validation
    bar = alpaca.get_latest_bar(asset)
    current_price = bar.c
    # Simple check: e.g., if volume > threshold, proceed
    if bar.v < 1000:  # Arbitrary low volume check
        return {"valid": False, "reason": "Low volume - high risk"}

    # Projected ROI based on quick calc (e.g., momentum)
    roi = 0.01  # Replace with real calc if needed
    return {"valid": True, "projected_roi": roi}


def get_trading_agents_strategies(asset):
    """Get strategy proposals from TradingAgents-main."""
    agent = TradingAgent(asset)
    agent.add_strategy(MovingAverageStrategy(period=14))
    agent.run()  # Run with live data
    return (
        agent.get_performance()
    )  # Returns dict like {'strategy': 'buy', 'expected_roi': 0.01}


async def super_flipper(asset, amount, hours):
    """Integrated super tool: Validate live, get agent strategies, vote, execute real trade."""
    # Step 1: Validate with live data
    validation = await validate_live_flip(asset, amount, hours)
    if not validation["valid"]:
        return {"error": validation["reason"]}

    # Step 2: Get strategies from TradingAgents
    ta_strategies = get_trading_agents_strategies(asset)

    # Step 3: Draymond coordination with sub-team vote
    draymond = DraymondAgent()
    await draymond.initialize()
    sub_team = create_sub_team()  # From sub_agents.py

    data = {"asset": asset, "amount": amount, "strategies": ta_strategies}
    collab_results = draymond.collaborate("vote_on_flip", data)
    if sum(1 for r in collab_results if r.get("vote") == "yes") < len(sub_team) / 2:
        return {"error": "Sub-team vote failed"}

    # Step 4: Execute real flip
    result = await draymond.flip_money_real(asset, amount, hours)
    result.update(validation)
    result["strategies_used"] = ta_strategies

    return result


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python super_flipper.py <asset> <amount> <hours>")
        sys.exit(1)

    asset = sys.argv[1]
    amount = float(sys.argv[2])
    hours = int(sys.argv[3])

    result = asyncio.run(super_flipper(asset, amount, hours))
    print(result)
