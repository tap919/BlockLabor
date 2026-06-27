'use strict';

const express = require('express');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const router = express.Router();
const emitter = new EventEmitter();

const ALLOWED_EVENTS = ['push', 'pull_request'];

function verifyGitHubSignature(payload, signature, secret) {
  if (!secret) return true;
  if (!signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

router.post(
  '/webhook/github',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
    const payload = req.body;

    if (secret) {
      const valid = verifyGitHubSignature(payload, signature, secret);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    if (event && ALLOWED_EVENTS.includes(event)) {
      let parsed;
      try {
        parsed = JSON.parse(payload.toString());
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
      emitter.emit(`github.${event}`, parsed);
    }

    res.status(200).json({ received: true });
  }
);

module.exports = { router, emitter };
