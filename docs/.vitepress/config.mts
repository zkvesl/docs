import { defineConfig } from 'vitepress'
import d2 from 'vitepress-plugin-d2'
import { Layout, Theme, FileType } from 'vitepress-plugin-d2/dist/config'
import { generateLlms } from '../../scripts/llms-generator.mjs'

export default defineConfig({
  title: 'vesl',
  description: 'Verifiable Execution and Settlement Layer',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],

  markdown: {
    config: (md) => {
      md.use(d2, {
        layout: Layout.ELK,
        theme: Theme.TERMINAL,
        darkTheme: Theme.TERMINAL,
        fileType: FileType.SVG,
        padding: 40,
      })
    },
  },

  // Regenerate llms.txt + llms-full.txt on every production build so the
  // agent-facing artifacts can never drift from the published pages.
  buildEnd(siteConfig) {
    generateLlms(siteConfig)
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
          {
            text: 'Get Started',
            link: '/setup/quickstart',
            collapsed: false,
            items: [
              { text: 'Docs for AI Agents', link: '/setup/llms' },
            ],
          },
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
          {
            text: 'Catalog Gates from Rust',
            link: '/build/catalog-gates/',
            collapsed: false,
            items: [
              { text: 'Gate Chains', link: '/build/catalog-gates/gate-chains' },
              { text: 'Swapping a Gate', link: '/build/catalog-gates/swapping' },
              { text: 'Custom Gates', link: '/build/catalog-gates/custom-gates' },
            ],
          },
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
          { text: 'Updating a Project', link: '/build/updating' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Glossary', link: '/reference/glossary' },
          { text: 'vesl-core', link: '/reference/vesl-core' },
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
})
