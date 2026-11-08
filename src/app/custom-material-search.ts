export type CustomMaterialSearchMode = 'characters' | 'phrase';

export function customMaterialSearchTerms(query: string, mode: CustomMaterialSearchMode): string[] {
 const text = query.trim();
 return [...new Set(mode === 'characters'
  ? [...text].filter(character => /\p{Script=Han}/u.test(character))
  : text.split(/[\s、，,；;]+/u).filter(Boolean))];
}

export function matchesCustomMaterial(word: string, lesson: string, query: string, mode: CustomMaterialSearchMode, terms = customMaterialSearchTerms(query, mode)): boolean {
 if (!query.trim()) return true;
 return terms.some(term => word.includes(term) || (mode === 'phrase' && lesson.includes(term)));
}
