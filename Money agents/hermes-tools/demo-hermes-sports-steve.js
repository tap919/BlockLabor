/**
 * Hermes x Sports Steve MVP - Usage Example
 *
 * This file demonstrates how an agent (e.g., Hermes) can integrate
 * with the Sports Steve MVP backend through the v2 wrapper.
 *
 * Usage:
 *   node hermes-tools/demo-hermes-sports-steve.js
 */

const {
  dispatchSportsSteveV2,
  sportsSteveV2Tools,
} = require('./sports-steve-v2.js');

async function main() {
  console.log('=== Hermes x Sports Steve MVP Demo ===\n');

  // 1. Check available tools
  console.log('Available tools:');
  sportsSteveV2Tools.forEach(function(t) {
    console.log('  - ' + t.name + ': ' + t.description);
  });

  // 2. Check backend health
  console.log('\n[1] Checking backend health...');
  try {
    var health = await dispatchSportsSteveV2('sports_steve_v2_health', {});
    console.log('    Health:', JSON.stringify(health));
  } catch (e) {
    console.error('    FAILED:', e.message);
  }

  // 3. Run NBA analysis
  console.log('\n[2] Running NBA analysis...');
  try {
    var analysis = await dispatchSportsSteveV2('sports_steve_v2_analyze', {
      sport: 'nba',
      bankroll: 500,
      max_risk_pct: 2.0,
    });
    console.log('    Strategy:', analysis.strategy);
    console.log('    Picks:');
    analysis.picks.forEach(function(p) {
      console.log(
        '      ' + p.game + ' | ' + p.pick + ' | edge=' + p.edge + ' | signal=' + p.signal
      );
    });
  } catch (e) {
    console.error('    FAILED:', e.message);
  }

  // 4. Run NFL analysis
  console.log('\n[3] Running NFL analysis...');
  try {
    var analysis2 = await dispatchSportsSteveV2('sports_steve_v2_analyze', {
      sport: 'nfl',
      bankroll: 500,
      max_risk_pct: 1.0,
    });
    console.log('    Strategy:', analysis2.strategy);
    console.log('    Picks:');
    analysis2.picks.forEach(function(p) {
      console.log(
        '      ' + p.game + ' | ' + p.pick + ' | edge=' + p.edge + ' | signal=' + p.signal
      );
    });
  } catch (e) {
    console.error('    FAILED:', e.message);
  }

  // 5. Quick picks
  console.log('\n[4] Getting quick NBA picks...');
  try {
    var result = await dispatchSportsSteveV2('sports_steve_v2_picks', {
      sport: 'nba',
    });
    console.log('    Picks:', JSON.stringify(result));
  } catch (e) {
    console.error('    FAILED:', e.message);
  }

  console.log('\n=== Demo complete ===');
}

main().catch(function(e) {
  console.error('Fatal error:', e);
  process.exit(1);
});
