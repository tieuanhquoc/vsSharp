---
  name: build-verify
  description: Check build prerequisites and compile extensions
  user-invocable: true
  ---

  # Build Verify

  ## Extensions to check
  - vssharp-runner, vssharp-explorer, vssharp-icons
  - vssharp-color-theme, vssharp-product-icons

  ## Commands
  - Compile: npm run compile
  - Type-check: npx tsc --noEmit