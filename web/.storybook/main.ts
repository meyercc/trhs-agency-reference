import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
  // Allow importing the shared design system CSS from the parent project.
  async viteFinal(cfg) {
    cfg.server = cfg.server || {};
    cfg.server.fs = { ...(cfg.server.fs || {}), allow: ['../..'] };
    return cfg;
  },
};
export default config;
