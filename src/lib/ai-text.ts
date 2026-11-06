export function stripMarkdownAsterisks(text: string) {
  return text.replace(/\*/g, "");
}
