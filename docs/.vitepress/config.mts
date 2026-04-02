import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'vesl',
  description: 'Verifiable Execution and Settlement Layer',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],

  themeConfig: {
    logo: '/vesl_horizontal_alpha.svg',
    siteTitle: false,

    nav: [
      { text: 'Guide', link: '/getting-started/overview' },
      { text: 'Reference', link: '/reference/cli' },
      { text: 'GitHub', link: 'https://github.com/zkVesl/vesl' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'What is vesl?', link: '/getting-started/overview' },
          { text: 'Quick Start', link: '/getting-started/quickstart' },
          { text: 'Installation', link: '/getting-started/installation' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Hull (Rust Harness)', link: '/architecture/hull' },
          { text: 'Hoon Kernels', link: '/architecture/kernels' },
          { text: 'Chunk Store', link: '/architecture/chunk-store' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Configuration', link: '/guides/configuration' },
          { text: 'Building a Hull', link: '/guides/building-a-hull' },
          { text: 'Writing Hoon', link: '/guides/writing-hoon' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI Commands', link: '/reference/cli' },
          { text: 'vesl.toml', link: '/reference/vesl-toml' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zkVesl/vesl' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: '~',
    },
  },
})
