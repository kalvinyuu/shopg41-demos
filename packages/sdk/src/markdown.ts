import type { PostContent } from "./types"

/**
 * Minimal Markdown → Tiptap doc converter (client-side twin of the server's
 * `shopG41/src/lib/blog-markdown.ts`). Covers headings, paragraphs, bullet
 * lists, code fences and quotes; everything else becomes plain paragraphs.
 * Keep the two in sync.
 */
export function markdownToTiptapDoc(markdown: string): PostContent {
  type Node = NonNullable<PostContent["content"]>[number]
  const content: Node[] = []
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")

  let inCode = false
  let codeLines: string[] = []
  let listItems: Node[][] = []

  const flushList = () => {
    if (listItems.length === 0) return
    content.push({
      type: "bulletList",
      content: listItems.map((item) => ({
        type: "listItem",
        content: [{ type: "paragraph", content: item }],
      })),
    } as Node)
    listItems = []
  }

  const inline = (text: string): Node[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter((p) => p !== "")
    return parts.map((p) => {
      const bold = p.match(/^\*\*(.+)\*\*$/)
      if (bold) return { type: "text", text: bold[1], marks: [{ type: "bold" }] } as Node
      const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        return {
          type: "text",
          text: link[1],
          marks: [{ type: "link", attrs: { href: link[2] } }],
        } as Node
      }
      return { type: "text", text: p } as Node
    })
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        content.push({
          type: "codeBlock",
          content: [{ type: "text", text: codeLines.join("\n") }],
        } as Node)
        codeLines = []
        inCode = false
      } else {
        flushList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushList()
      content.push({
        type: "heading",
        attrs: { level: heading[1]!.length },
        content: inline(heading[2]!.trim()),
      } as Node)
      continue
    }

    const image = line.match(/^\s*!\[([^\]]*)\]\((\S+)\)\s*$/)
    if (image) {
      flushList()
      content.push({
        type: "image",
        attrs: { src: image[2]!, alt: image[1]! },
      } as Node)
      continue
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      listItems.push(inline(bullet[1]!.trim()))
      continue
    }

    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      flushList()
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: inline(quote[1] ?? "") }],
      } as Node)
      continue
    }

    if (line.trim() === "") {
      flushList()
      continue
    }

    flushList()
    content.push({ type: "paragraph", content: inline(line.trim()) } as Node)
  }
  flushList()
  if (inCode) {
    content.push({
      type: "codeBlock",
      content: [{ type: "text", text: codeLines.join("\n") }],
    } as Node)
  }
  if (content.length === 0) content.push({ type: "paragraph" } as Node)
  return { type: "doc", content }
}
