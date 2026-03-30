/**
 * Utility for highlighting text in HTML content based on plain-text offsets.
 *
 * The approach:
 * 1. When user selects text, we compute the offset in plain text (HTML stripped)
 * 2. To highlight, we parse the HTML, walk text nodes, and inject <mark> tags
 *    at the exact character offsets — even when selection spans multiple tags.
 */

export interface HighlightRange {
  id: string;
  startOffset: number;
  endOffset: number;
  color?: string;
  isActive?: boolean;
}

/**
 * Strip HTML tags and return plain text (matching browser's textContent).
 */
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * Get selected text info relative to a container element.
 * Returns null if selection is empty or not within the container.
 */
export function getSelectionOffsets(containerEl: HTMLElement): {
  text: string;
  startOffset: number;
  endOffset: number;
} | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);

  // Check that the selection is within our container
  if (!containerEl.contains(range.startContainer) || !containerEl.contains(range.endContainer)) {
    return null;
  }

  const text = selection.toString();
  if (!text.trim()) return null;

  // Compute character offset in the full plain text
  const startOffset = getCharOffset(containerEl, range.startContainer, range.startOffset);
  const endOffset = getCharOffset(containerEl, range.endContainer, range.endOffset);

  if (startOffset === -1 || endOffset === -1) return null;

  return { text, startOffset, endOffset };
}

/**
 * Get the character offset of a point (node + offset) relative to the container's textContent.
 */
function getCharOffset(container: Node, targetNode: Node, targetOffset: number): number {
  let charCount = 0;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node === targetNode) {
      return charCount + targetOffset;
    }
    charCount += (node.textContent || '').length;
  }

  // If targetNode is an element (not text), count children
  if (targetNode === container || container.contains(targetNode)) {
    charCount = 0;
    const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node2: Text | null;
    while ((node2 = walker2.nextNode() as Text | null)) {
      if (targetNode.nodeType === Node.ELEMENT_NODE) {
        // targetOffset is the number of child nodes before the point
        const parentEl = targetNode as Element;
        const childBefore = parentEl.childNodes[targetOffset - 1];
        if (childBefore && node2.compareDocumentPosition(childBefore) & Node.DOCUMENT_POSITION_PRECEDING) {
          continue;
        }
        if (count >= targetOffset) {
          return charCount;
        }
      }
      charCount += (node2.textContent || '').length;
      count++;
    }
    return charCount;
  }

  return -1;
}

/**
 * Inject <mark> tags into HTML at the given plain-text offset ranges.
 * This properly handles ranges that span multiple HTML tags.
 */
export function injectHighlights(html: string, ranges: HighlightRange[]): string {
  if (!ranges.length) return html;

  // Sort ranges by startOffset
  const sorted = [...ranges].sort((a, b) => a.startOffset - b.startOffset);

  // Parse HTML into a temporary container
  const container = document.createElement('div');
  container.innerHTML = html;

  // Collect all text nodes with their offsets
  const textNodes: Array<{ node: Text; start: number; end: number }> = [];
  let charCount = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    const len = (textNode.textContent || '').length;
    textNodes.push({ node: textNode, start: charCount, end: charCount + len });
    charCount += len;
  }

  // For each range, find affected text nodes and wrap the appropriate portion
  // Process in reverse order to avoid offset shifts
  for (let ri = sorted.length - 1; ri >= 0; ri--) {
    const range = sorted[ri];
    const { startOffset, endOffset, id, color, isActive } = range;

    for (let ti = textNodes.length - 1; ti >= 0; ti--) {
      const tn = textNodes[ti];

      // Skip text nodes that don't overlap with this range
      if (tn.end <= startOffset || tn.start >= endOffset) continue;

      const nodeText = tn.node.textContent || '';
      const localStart = Math.max(0, startOffset - tn.start);
      const localEnd = Math.min(nodeText.length, endOffset - tn.start);

      if (localStart >= localEnd) continue;

      // Split the text node and wrap the highlighted portion
      const before = nodeText.slice(0, localStart);
      const highlighted = nodeText.slice(localStart, localEnd);
      const after = nodeText.slice(localEnd);

      const mark = document.createElement('mark');
      mark.setAttribute('data-comment-id', id);
      mark.className = isActive
        ? 'review-highlight review-highlight-active'
        : 'review-highlight';
      if (color) mark.style.backgroundColor = color;
      mark.textContent = highlighted;

      const parent = tn.node.parentNode;
      if (!parent) continue;

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));

      parent.replaceChild(frag, tn.node);
    }
  }

  return container.innerHTML;
}
