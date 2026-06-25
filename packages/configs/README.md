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

For JavaScript codebases that use TypeScript for `.ts`/`.tsx` files only (not checking `.js`/`.jsx` files), use the JavaScript-compatible variant:

```json
{
  "extends": "@blocklabor/configs/tsconfig.js.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

This variant enables `allowJs` but disables `checkJs` to avoid type-checking untyped JavaScript files. It's suitable for projects that have some TypeScript files alongside JavaScript files. The strictest TypeScript checks are disabled to accommodate untyped code.
