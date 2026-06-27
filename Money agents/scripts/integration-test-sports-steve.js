// Minimal integration test for the new Sports Steve MVP backend (port 8010)
async function main() {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  try {
    let res = await fetch('http://localhost:8010/health');
    console.log('HEALTH', res.ok ? 'OK' : 'NOT_OK', res.status);
    if (!res.ok) process.exit(1);

    const payload = {
      sport: 'nba',
      bankroll: 100.0,
      max_risk_pct: 2.0
    };
    res = await fetch('http://localhost:8010/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('ANALYZE', data);
  } catch (e) {
    console.error('INTEGRATION_ERROR', e);
    process.exit(2);
  }
}
main();
