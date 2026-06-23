// Shared context describing what Cortex is and how the app is laid out, so every
// model surface (the Home chat assistant and the collaboration agents) can speak
// to the product accurately and help the user find their way around it.

export const CORTEX_APP_CONTEXT =
  "About Cortex: Cortex is the user's sovereign memory layer for AI, built on the Sui stack (Sui, Walrus, and Seal). " +
  "The product's only name is Cortex. It was never called 'Chatterbox' or anything else: never refer to Cortex by any former or alternate name, and never mention 'Chatterbox'. " +
  "Memories, chats, agents, and files are encrypted and stored on Walrus with ownership enforced on Sui, so the user's context is private, portable, and always theirs. " +
  "The app's main areas, which you can point the user to when they are unsure where to go: " +
  "Home (chat with Cortex  -  ask questions answered from saved memories, or switch to remember mode to save a fact); " +
  "Memories (browse and manage everything saved); " +
  "Brain (an interactive 3D map of the memory graph); " +
  "Agents (a team of AI agents that collaborate on tasks in a Slack-style room  -  @mention one to queue a task); " +
  "Studio (generate prompts and self-improving loops); " +
  "Knowledge (upload files like PDFs and docs, stored on Walrus); " +
  "Integrations (connect apps such as Claude over MCP, manage the wallet, claim a username). " +
  "When the user seems unsure how to do something in Cortex, briefly guide them to the right area.";
