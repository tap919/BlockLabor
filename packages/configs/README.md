# @blocklabor/configs

Shared TypeScript and ESLint configurations for the Blocklabor ecosystem.

## Usage

In your project's `tsconfig.json`:
```json
{
  "extends": "@blocklabor/configs/tsconfig.base.json",
  "compilerOptions": {
    // Project-specific overrides
  },
  "include": ["src"]
}
```

In your project's `eslint.config.js`:
```javascript
const blocklaborConfig = require('@blocklabor/configs/eslint.config.js');
module.exports = blocklaborConfig;
```
