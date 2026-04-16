declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(pages: HTMLElement[]): void;
    on(event: string, callback: (e: { data: number }) => void): void;
    flipNext(): void;
    flipPrev(): void;
    destroy(): void;
  }
}
