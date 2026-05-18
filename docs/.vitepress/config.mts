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
          { text: 'What Is VESL', link: '/welcome/what-is-vesl' },
        ],
      },
      {
        text: 'Setup',
        items: [
          { text: 'Get Started', link: '/setup/quickstart' },
        ],
      },
      {
        text: 'Build a Nockapp',
        items: [
          { text: 'NockApp Anatomy', link: '/build/anatomy' },
          { text: 'Hull', link: '/build/hull' },
          {
            text: 'Grafts',
            link: '/build/grafts/',
            collapsed: false,
            items: [
              { text: 'Inject', link: '/build/grafts/inject' },
              { text: 'Manifest Schema', link: '/build/grafts/manifest-schema' },
              { text: 'The Trellis Pattern', link: '/build/grafts/trellis-pattern' },
            ],
          },
          {
            text: 'Kernel',
            link: '/build/kernel/',
            collapsed: false,
            items: [
              { text: 'Domain Causes', link: '/build/kernel/causes' },
              { text: 'Domain Peeks', link: '/build/kernel/peeks' },
              { text: 'Verification Gates', link: '/build/kernel/gates' },
              { text: 'Multi-Graft Coordination', link: '/build/kernel/multi-graft' },
            ],
          },
          { text: 'Catalog Gates from Rust', link: '/build/catalog-gates' },
          {
            text: 'Build & Run',
            link: '/build/build-run/',
            collapsed: false,
            items: [
              { text: 'Serve Subcommand', link: '/build/build-run/serve' },
              { text: 'Fakenet Walkthrough', link: '/build/build-run/fakenet' },
              { text: 'Dumbnet Walkthrough', link: '/build/build-run/dumbnet' },
            ],
          },
          {
            text: 'Testing',
            link: '/build/testing/',
            collapsed: false,
            items: [
              { text: 'Rust Harness', link: '/build/testing/harness' },
              { text: 'Domain Pokes', link: '/build/testing/domain-pokes' },
              { text: 'Slog Diagnostics', link: '/build/testing/slog-diagnostics' },
              { text: 'CLI', link: '/build/testing/cli' },
            ],
          },
          { text: 'State & Snapshots', link: '/build/state-snapshots' },
          { text: 'vesl-core', link: '/build/vesl-core' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Glossary', link: '/reference/glossary' },
          { text: 'Library Catalog', link: '/reference/library' },
          { text: 'Peek Catalog', link: '/reference/peek-catalog' },
          { text: 'Effect Catalog', link: '/reference/effect-catalog' },
          { text: 'CLI (nockup graft)', link: '/reference/cli' },
          { text: 'nockapp.toml', link: '/reference/nockapp-toml' },
          { text: 'vesl.toml', link: '/reference/vesl-toml' },
        ],
      },
      {
        text: 'Troubleshooting',
        items: [
          { text: 'Common Pitfalls', link: '/troubleshooting/common-pitfalls' },
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
