# Bankroll Management Reference

## Kelly Criterion

Full Kelly formula (decimal odds):

```
f* = (p * b - q) / b
```

Where:

- `f*` = fraction of bankroll to bet
- `p` = probability of winning
- `q` = 1 - p (probability of losing)
- `b` = decimal odds - 1 (net return per unit staked)

**Always use half-Kelly or fractional Kelly** to reduce variance:

- Full Kelly: maximizes long-run growth but extreme drawdowns
- Half-Kelly (f\*/2): recommended — reduces drawdown significantly
- Quarter-Kelly: ultra-conservative, for high-uncertainty estimates

**Cap at 5% regardless of Kelly output.** Kelly assumes perfectly calibrated probabilities; real estimates are always off.

## Probability Estimation

For moneylines (h2h markets), use sharp lines as no-vig probability:

```python
def no_vig_prob(odds_home: float, odds_away: float) -> tuple[float, float]:
    """Remove vig from two-way market to get fair probabilities."""
    p_home = 1 / odds_home
    p_away = 1 / odds_away
    total = p_home + p_away
    return p_home / total, p_away / total
```

**Use Pinnacle as the sharp reference line.** Their margin is lowest and lines are most efficient.

If Pinnacle is not available, use the consensus line from The Odds API (average of top books).

## Closing Line Value (CLV)

CLV = measure of bet quality relative to where the line closed.

```
CLV% = (closing_odds / bet_odds - 1) * 100
```

Positive CLV = you got better odds than the closing line = value bet.

Track CLV per bet. Long-run positive CLV almost always leads to profit.

**Target:** average CLV of +1% or better across all bets.

## ROI and Sample Size

| Sample Size   | Confidence Level                  |
| ------------- | --------------------------------- |
| < 100 bets    | Very low — results largely noise  |
| 100-500 bets  | Low — trend visible               |
| 500-1000 bets | Medium — statistically meaningful |
| 1000+ bets    | High — reliable signal            |

**Minimum 500 bets before judging a strategy.** Short-term losses do not mean the strategy is losing; variance is enormous in sports betting.

Expected ROI by bettor type:

- Recreational: -5% to -10% (house edge)
- Sharp: +1% to +5%
- Professional: +3% to +8%

## Bankroll Growth Targets

| Conservative           | Moderate               | Aggressive                 |
| ---------------------- | ---------------------- | -------------------------- |
| 1-2% monthly ROI       | 3-5% monthly ROI       | 5-10% monthly ROI          |
| Max bet: 1-2% bankroll | Max bet: 3-5% bankroll | Max bet: 5% bankroll       |
| Flat betting           | Half-Kelly             | Half-Kelly + line shopping |

## Staking Plans

**Flat betting:** Fixed dollar amount per bet. Simple. Lower variance.

- Best for beginners or uncertain models.

**Kelly staking:** Varies bet size with edge. Higher growth rate.

- Best when probabilities are well-calibrated.

**Unit staking:** Fix 1 unit = 1% bankroll; bet 1-5 units by confidence.

- Good middle ground. Adjust unit count, not unit size.

## Bankroll Reload Rules

- If bankroll drops below 50% of target: reload from business profits only
- Never borrow or use trading capital to reload
- After reload, reset daily stop-loss to 10% of new bankroll
- If bankroll drops to zero: stop, audit all bets, fix the model before resuming
