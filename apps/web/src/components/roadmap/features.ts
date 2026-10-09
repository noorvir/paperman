export type FeatureCategory = "Internal" | "User facing";

export const features: {
  id: string;
  title: string;
  description: string;
  done: boolean;
  date: string | null;
  category: FeatureCategory;
}[] = [
  {
    id: "correspondents-parties",
    title: "Implement correspondents / parties",
    description:
      "Group documents by the person or organization that sent them, or by other relevant parties.",
    category: "User facing",
    done: false,
    date: null,
  },
  {
    id: "pdf-preloading",
    title: "PDF preloading and client-side caching",
    description:
      "Preload documents to reduce PDF loading time. Cache PDFs on the client where possible, while respecting access permissions and document updates.",
    category: "Internal",
    done: false,
    date: null,
  },
  {
    id: "ingestion",
    title: "Modular document ingestion",
    description:
      "Add new sources through a shared ingestion interface. Send documents by email and let PaperMan process and file them automatically.",
    category: "User facing",
    done: false,
    date: "2026-10-16",
  },
  {
    id: "search",
    title: "Semantic, keyword & hybrid search",
    description:
      "Find documents by meaning, exact words, or a combination of both.",
    category: "User facing",
    done: false,
    date: "2026-10-15",
  },
  {
    id: "mcp",
    title: "MCP for agent access",
    description:
      "Connect AI agents to PaperMan through MCP so they can find and work with documents you allow them to access.",
    category: "User facing",
    done: false,
    date: "2026-10-14",
  },
  {
    id: "mobile-app",
    title: "Mobile app",
    description:
      "Access and manage your documents through an app designed for your phone.",
    category: "User facing",
    done: false,
    date: "2026-10-13",
  },
  {
    id: "formatted-markdown",
    title: "Formatted Markdown output",
    description:
      "Convert document content into readable Markdown with headings, lists, and tables.",
    category: "User facing",
    done: false,
    date: "2026-10-12",
  },
  {
    id: "translation",
    title: "Basic translation",
    description:
      "Translate document text into your preferred language, with the original available for reference.",
    category: "User facing",
    done: false,
    date: "2026-10-11",
  },
  {
    id: "download",
    title: "Document download",
    description:
      "Download filed documents directly from PaperMan for offline use or sharing.",
    category: "User facing",
    done: false,
    date: "2026-10-10",
  },
  {
    id: "authentication",
    title: "Authentication & public access",
    description:
      "Sign in securely and access PaperMan over the internet. Keep documents limited to authorized users.",
    category: "User facing",
    done: false,
    date: "2026-10-09",
  },
  {
    id: "v1",
    title: "v1",
    description:
      "Scan processing and filing, owners, tags, and document previews.\nPage selection, rotation, ordering, verification, and the overview dashboard.",
    category: "User facing",
    done: true,
    date: "2026-10-08",
  },
];
