import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: 'Cortex Docs',
  description:
    'Documentation for the Cortex app, durable memory platform, MCP server, and user-controlled infrastructure.',
  accentColor: 'light-dark(black, white)',
  colorScheme: 'light dark',
  rootDir: '.',
  srcDir: '.',
  logoUrl: {
    dark: '/cortex-mark.svg',
    light: '/cortex-mark.svg',
  },
  topNav: [
    {
      text: 'Docs',
      link: '/',
      match: '/',
    },
  ],
  sidebar: [
    {
      text: 'Overview',
      items: [
        {
          text: 'Docs Home',
          link: '/',
        },
      ],
    },
    {
      text: 'Cortex App',
      items: [
        {
          text: 'Overview',
          link: '/dashboard',
        },
      ],
    },
    {
      text: 'Developer Platform',
      items: [
        {
          text: 'Getting Started',
          items: [
            {
              text: 'Overview',
              link: '/platform/getting-started/overview',
            },
            {
              text: 'Quickstart',
              link: '/platform/getting-started/quickstart',
            },
            {
              text: 'Install with AI',
              link: '/platform/getting-started/install-with-ai',
            },
          ],
        },
        {
          text: 'Concepts',
          items: [
            {
              text: 'How Cortex Works',
              link: '/platform/concepts/how-supermemory-works',
            },
            {
              text: 'Graph Memory',
              link: '/platform/concepts/graph-memory',
            },
            {
              text: 'Content Types',
              link: '/platform/concepts/content-types',
            },
            {
              text: 'Recall and Search',
              link: '/platform/concepts/superrag',
            },
            {
              text: 'Memory vs RAG',
              link: '/platform/concepts/memory-vs-rag',
            },
            {
              text: 'Container Tags',
              link: '/platform/concepts/container-tags',
            },
            {
              text: 'Sharing and Permissions',
              link: '/platform/concepts/multi-tenancy-filtering',
            },
            {
              text: 'User Profiles',
              link: '/platform/concepts/user-profiles',
            },
            {
              text: 'Customization',
              link: '/platform/concepts/customization',
            },
            {
              text: 'Authentication',
              link: '/platform/concepts/authentication',
            },
          ],
        },
        {
          text: 'Using Cortex',
          items: [
            {
              text: 'Add Context',
              link: '/platform/using-supermemory/add-context',
            },
            {
              text: 'Search Memories and Docs',
              link: '/platform/using-supermemory/search-memories-and-docs',
            },
            {
              text: 'User Profiles',
              link: '/platform/using-supermemory/user-profiles',
            },
            {
              text: 'Manage Content',
              items: [
                {
                  text: 'Overview',
                  link: '/platform/using-supermemory/manage-content',
                },
                {
                  text: 'Organize Content',
                  link: '/platform/using-supermemory/manage-content/organize-content',
                },
                {
                  text: 'Archive and Delete',
                  link: '/platform/using-supermemory/manage-content/archive-and-delete',
                },
              ],
            },
          ],
        },
        {
          text: 'Use Cases',
          items: [
            {
              text: 'Overview',
              link: '/platform/use-cases',
            },
          ],
        },
        {
          text: 'MCP Connection',
          items: [
            {
              text: 'Overview',
              link: '/platform/mcp-connection/overview',
            },
            {
              text: 'Connectors',
              items: [
                {
                  text: 'Overview',
                  link: '/platform/mcp-connection/connectors',
                },
                {
                  text: 'Claude Code',
                  link: '/platform/mcp-connection/connectors/claude-code',
                },
                {
                  text: 'Cursor',
                  link: '/platform/mcp-connection/connectors/cursor',
                },
              ],
            },
            {
              text: 'Troubleshooting',
              link: '/platform/mcp-connection/troubleshooting',
            },
            {
              text: 'Managing Resources',
              link: '/platform/mcp-connection/managing-resources',
            },
          ],
        },
      ],
    },
    {
      text: 'Cortex MCP',
      items: [
        {
          text: 'Overview',
          link: '/mcp/overview',
        },
        {
          text: 'Connectors',
          link: '/mcp/connectors',
        },
        {
          text: 'Troubleshooting',
          link: '/mcp/troubleshooting',
        },
        {
          text: 'Managing Resources',
          link: '/mcp/managing-resources',
        },
      ],
    },
    {
      text: 'Infrastructure',
      items: [
        {
          text: 'Overview',
          link: '/smfs',
        },
      ],
    },
  ],
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/goodylili/Cortex',
    },
  ],
  editLink: {
    link: 'https://github.com/goodylili/Cortex/edit/main/docs/pages/:path',
    text: 'Edit this page on GitHub',
  },
})
