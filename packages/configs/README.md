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

## JavaScript Projects

For JavaScript codebases that use TypeScript for type-checking only, use the JavaScript-compatible variant:

```json
{
  "extends": "@blocklabor/configs/tsconfig.js.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

This variant enables `allowJs` and `checkJs` but disables `strict` mode to avoid breaking untyped JavaScript code. It's suitable for projects that are primarily JavaScript but want some type checking via JSDoc comments or gradual TypeScript migration.
