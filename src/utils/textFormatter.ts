// Simple text formatter for event titles
// Supports: ~~strikethrough~~, **bold**, *italic*

export function formatEventText(text: string): string {
  if (!text) return '';
  
  let formatted = text;
  
  // Convert ~~text~~ to <s>text</s> (strikethrough)
  formatted = formatted.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  
  // Convert **text** to <strong>text</strong> (bold)
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert *text* to <em>text</em> (italic) - but not if it's part of **
  formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  return formatted;
}