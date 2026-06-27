'use strict';

const express = require('express');

const router = express.Router();

async function aggregateHealth() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    services: {},
  };
}

router.get('/health', async (req, res) => {
  try {
    const health = await aggregateHealth();
    res.status(200).json(health);
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

module.exports = { router, aggregateHealth };
