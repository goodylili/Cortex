import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: 'Cortex Docs',
  description:
    'Cortex is the sovereign memory layer built on Sui, Walrus, and Seal. Keep durable encrypted memory, share it selectively, and turn it into prompts, loops, multi-agent workflows, and dreams.',
  accentColor: 'light-dark(black, white)',
  colorScheme: 'light dark',
  rootDir: '.',
  srcDir: '.',
  logoUrl: {
    dark: '/cortex-mark.svg',
    light: '/cortex-mark.svg',
  },
  topNav: [
    { text: 'Docs', link: '/', match: '/' },
    { text: 'Launch App', link: 'https://github.com/goodylili/Cortex' },
  ],
  sidebar: [
    {
      text: 'Overview',
      items: [
        { text: 'Introduction', link: '/' },
        { text: 'Why Cortex', link: '/why-cortex' },
      ],
    },
    {
      text: 'Getting Started',
      items: [
        { text: 'Installation', link: '/getting-started/installation' },
        { text: 'Quickstart', link: '/getting-started/quickstart' },
        { text: 'Configuration', link: '/getting-started/configuration' },
      ],
    },
    {
      text: 'Core Concepts',
      items: [
        { text: 'How Cortex Works', link: '/concepts/how-cortex-works' },
        { text: 'The Memory Model', link: '/concepts/memory-model' },
        { text: 'Store · Coordinate · Dream', link: '/concepts/store-coordinate-dream' },
        { text: 'Memory vs RAG', link: '/concepts/memory-vs-rag' },
        { text: 'The Elastic Brain', link: '/concepts/elastic-brain' },
        { text: 'Dreams', link: '/concepts/dreams' },
        { text: 'Encryption', link: '/concepts/encryption' },
        { text: 'Sharing & Permissions', link: '/concepts/sharing' },
      ],
    },
    {
      text: 'Cortex App',
      items: [{ text: 'Overview', link: '/app/overview' }],
    },
    {
      text: 'Agentic Loops',
      items: [
        { text: 'Overview', link: '/loops/overview' },
        { text: 'The Loop Spec', link: '/loops/loop-spec' },
      ],
    },
    {
      text: 'MCP Server',
      items: [
        { text: 'Overview', link: '/mcp/overview' },
        { text: 'Tool Reference', link: '/mcp/tools' },
        {
          text: 'Connectors',
          items: [
            { text: 'Claude Code', link: '/mcp/connectors/claude-code' },
            { text: 'Cursor', link: '/mcp/connectors/cursor' },
          ],
        },
        { text: 'Troubleshooting', link: '/mcp/troubleshooting' },
      ],
    },
    {
      text: 'Infrastructure',
      items: [{ text: 'Sui · Walrus · Seal · MemWal', link: '/infrastructure/overview' }],
    },
  ],
  socials: [{ icon: 'github', link: 'https://github.com/goodylili/Cortex' }],
  editLink: {
    link: 'https://github.com/goodylili/Cortex/edit/main/docs/pages/:path',
    text: 'Edit this page on GitHub',
  },
})
