declare module 'nspell' {
  interface NSpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean };
    add(word: string): this;
    remove(word: string): this;
    wordCharacters(): string | undefined;
    personal(dic: string): this;
    dictionary(dic: string): this;
  }

  function NSpell(aff: string | Uint8Array, dic?: string | Uint8Array): NSpellInstance;
  export = NSpell;
}
