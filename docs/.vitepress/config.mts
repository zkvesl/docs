import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'vesl',
  description: 'Verifiable Execution and Settlement Layer',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: false,

    nav: [
      { text: 'Guide', link: '/welcome/what-is-vesl' },
      { text: 'Reference', link: '/reference/cli' },
      { text: 'GitHub', link: 'https://github.com/zkVesl/vesl-core' },
    ],

    sidebar: [
      {
        text: 'Welcome',
        items: [
          { text: 'What is vesl', link: '/welcome/what-is-vesl' },
        ],
      },
      {
        text: 'Setup',
        items: [
          { text: 'Install', link: '/setup/install' },
          { text: 'Your first nockapp', link: '/setup/quickstart' },
        ],
      },
      {
        text: 'Build a nockapp',
        items: [
          { text: 'Shape of a nockapp', link: '/build/shape' },
          { text: 'Initialize a project', link: '/build/initialize' },
          { text: 'Install grafts', link: '/build/install-grafts' },
          { text: 'Wire with graft-inject', link: '/build/wire' },
          { text: 'Write the kernel (Hoon)', link: '/build/kernel-hoon' },
          { text: 'The Rust driver', link: '/build/rust-driver' },
          { text: 'Testing', link: '/build/testing' },
          { text: 'State & snapshots', link: '/build/state-snapshots' },
          { text: 'Build & run', link: '/build/build-run' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI (graft-inject)', link: '/reference/cli' },
          { text: 'Graft manifest schema', link: '/reference/graft-manifest' },
          { text: 'vesl.toml', link: '/reference/vesl-toml' },
          { text: 'Glossary', link: '/reference/glossary' },
        ],
      },
      {
        text: 'Going deeper',
        items: [
          { text: 'vesl-core', link: '/going-deeper/vesl-core' },
        ],
      },
      {
        text: 'Troubleshooting',
        items: [
          { text: 'Common pitfalls', link: '/troubleshooting/common-pitfalls' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zkVesl/vesl-core' },
    ],

    search: {
      provider: 'local',
    },
  },
}))
