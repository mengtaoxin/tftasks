import node from '@mengtaoxin/oxc-config/node';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [node],
  // Empty array = do not re-add default plugins on top of the preset.
  plugins: [],
});
