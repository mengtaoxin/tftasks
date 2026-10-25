import fmt from '@mengtaoxin/oxc-config/fmt';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...fmt,
  ignorePatterns: [...(fmt.ignorePatterns ?? []), 'coverage/'],
});
