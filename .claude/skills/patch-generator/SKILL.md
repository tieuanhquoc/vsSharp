---
  name: patch-generator
  description: Automate VS Sharp patch workflow
  disable-model-invocation: true
  ---

  # Patch Generator

  ## Standard workflow
  1. Edit files in vssharp/vscode-overrides/
  2. Run ./vssharp/gen-patches.sh
  3. Patches auto-copied to vscode/

  ## Notes
  - Never edit vscode/ directly - it is a build artifact
  - Patch files must be committed separately