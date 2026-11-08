import {customMaterialSearchTerms} from './custom-material-search';

const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase();

/** Multiple terms match any course; filtering never changes a selection. */
export function courseMatchesSearch(query:string,course:{title?:string;number?:number|string}|null|undefined,words:string[]=[]):boolean{
 const terms=customMaterialSearchTerms(normalize(query).replace(/第\s*(\d+)\s*課/gu,'第$1課'),'phrase');
 if(!terms.length)return true;
 const text=normalize([course?.title||'',course?.number===undefined?'':`第${course.number}課`,...words].join(' '));
 return terms.some(term=>{const numeric=term.match(/^(?:第)?(\d+)(?:課)?$/u);return numeric?Number(numeric[1])===Number(course?.number):text.includes(term)});
}
