'use strict';

const express = require('express');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const router = express.Router();
const emitter = new EventEmitter();

function verifyStripeSignature(payload, signature, secret) {
  const elements = signature.split(',');
  let timestamp = null;
  let v1 = null;

  for (const el of elements) {
    const [key, value] = el.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') v1 = value;
  }

  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
}

router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const payload = req.body;

    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !secret) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (secret && signature) {
      try {
        const valid = verifyStripeSignature(payload.toString(), signature, secret);
        if (!valid) {
          return res.status(400).json({ error: 'Invalid signature' });
        }
      } catch (err) {
        return res.status(400).json({ error: 'Signature verification failed' });
      }
    } else if (secret && !signature) {
      return res.status(400).json({ error: 'Missing stripe signature' });
    }

    let event;
    try {
      event = JSON.parse(payload.toString());
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    emitter.emit('stripe.event', event);
    emitter.emit(`stripe.${event.type}`, event);

    res.status(200).json({ received: true });
  }
);

module.exports = { router, emitter };
