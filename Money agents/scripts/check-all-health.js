// Health orchestrator for integrated sandbox components
// Checks OTM (3000), Sports Steve (8010), OmniVoice (8000)
const fetch = require('node-fetch'); // Ensure node-fetch is available

async function check(url) {
  try {
    const res = await fetch(url, { timeout: 5000 });
    if (res.ok) return { url, status: 'online', code: res.status };
    return { url, status: 'offline', code: res.status };
  } catch (err) {
    return { url, status: 'offline', error: err.message };
  }
}

async function main() {
  const endpoints = {
    otm: 'http://127.0.0.1:3000',
    sports: 'http://localhost:8010/health',
    omnivoice: 'http://localhost:8000/health',
  };

  const tasks = Object.entries(endpoints).map(([k, v]) => check(v).then(r => ({ k, ...r })));
  const results = await Promise.all(tasks);
  console.log(JSON.stringify(results, null, 2));
}

main();
