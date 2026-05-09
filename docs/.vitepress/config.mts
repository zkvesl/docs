import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'vesl',
  description: 'Verifiable Execution and Settlement Layer',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],

  mermaid: {
    theme: 'base',
    themeVariables: {
      background: 'transparent',
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
      fontSize: '14px',
      primaryColor: '#0a0a0a',
      primaryBorderColor: '#00ffa3',
      primaryTextColor: '#00ffa3',
      secondaryColor: '#111111',
      secondaryBorderColor: 'rgba(0, 255, 163, 0.5)',
      secondaryTextColor: '#00ffa3',
      tertiaryColor: '#1a1a1a',
      tertiaryBorderColor: 'rgba(0, 255, 163, 0.4)',
      tertiaryTextColor: '#00ffa3',
      lineColor: '#00ffa3',
      mainBkg: '#0a0a0a',
      altBackground: '#111111',
      nodeBorder: '#00ffa3',
      clusterBkg: '#111111',
      clusterBorder: 'rgba(0, 255, 163, 0.5)',
      edgeLabelBackground: '#0a0a0a',
      labelBackground: '#0a0a0a',
      labelTextColor: '#00ffa3',
      actorBkg: '#0a0a0a',
      actorBorder: '#00ffa3',
      actorTextColor: '#00ffa3',
      actorLineColor: '#00ffa3',
      signalColor: '#00ffa3',
      signalTextColor: '#00ffa3',
      noteBkgColor: '#111111',
      noteTextColor: '#00ffa3',
      noteBorderColor: 'rgba(0, 255, 163, 0.5)',
      sequenceNumberColor: '#0a0a0a',
      activationBkgColor: '#1a1a1a',
      activationBorderColor: '#00ffa3',
    },
    flowchart: {
      curve: 'linear',
      htmlLabels: true,
    },
  },

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
          { text: 'Get a nockapp running', link: '/setup/quickstart' },
        ],
      },
      {
        text: 'Build a nockapp',
        items: [
          { text: 'Shape of a nockapp', link: '/build/shape' },
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
