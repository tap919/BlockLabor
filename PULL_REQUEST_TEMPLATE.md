## Description

<!-- Briefly describe the change. Link any related issues: Closes #123 -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Refactor (no functional change)
- [ ] Test addition or fix

## Impact

<!-- What does this affect? New env vars, new dependencies, schema migrations, RLS changes, new env vars, Sentry tags, etc. -->

## Security Checklist

- [ ] No secrets, API keys, or PII committed
- [ ] RLS policies updated if schema changed
- [ ] New env vars added to `.env.example` (NOT `.env`)
- [ ] Webhook signatures verified for any new external integrations
- [ ] Sentry `beforeSend` scrubber reviewed for any new PII fields
- [ ] No new `as any` casts in service types

## Testing

<!-- How was this verified? -->

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes (if backend code changed)
- [ ] `npm run e2e` passes (if UI flow changed)

## Screenshots / Recordings

<!-- If applicable, add screenshots or a short recording of the change. -->

## Deployment Notes

<!-- Anything operators need to know: env vars to set, migrations to run, feature flags, etc. -->
