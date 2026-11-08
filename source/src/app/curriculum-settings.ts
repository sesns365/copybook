import source,{LESSON_META,getLessonMeta,isCustomLesson,customLessonMap} from './curriculum-source';
export const curriculumEntries=Object.entries(source).flatMap(([lesson,entries])=>entries.map((entry,index)=>({...entry,bookId:LESSON_META[lesson].bookId,id:lesson+'|'+index,lesson,character:entry.word[entry.targetIdx]})));
export function teachingCurriculum(overrides:Record<string,any>={},customEntries:Record<string,any>={},includeDisabled=false,customLessons?:Record<string,any>){
 const lessons=Object.fromEntries(Object.entries(source).map(([lesson,entries])=>[lesson,entries.map((entry,index)=>({...entry,bookId:LESSON_META[lesson].bookId,...overrides[lesson+'|'+index],id:lesson+'|'+index,lesson,character:entry.word[entry.targetIdx]}))]));
 for(const [id,lesson]of Object.entries(customLessons||{})){if(lesson.deleted)delete lessons[id];else lessons[id]=[];}
 for(const e of Object.values(customEntries))if(isCustomLesson(e.lesson)&&(!customLessons||customLessons[e.lesson]&&!customLessons[e.lesson].deleted))lessons[e.lesson]??=[];
 for(const [id,e] of Object.entries(customEntries))if(lessons[e.lesson]&&(includeDisabled||e.enabled!==false))lessons[e.lesson].push({...e,id,bookId:getLessonMeta(e.lesson)!.bookId,character:e.word[e.targetIdx],source:'teacher'});
 return lessons;
}
export const isCustomEntryId=(id:unknown)=>typeof id==='string'&&/^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
export const allTeachingEntries=(settings:any={},includeDisabled=false)=>Object.values(teachingCurriculum(settings?.entryOverrides,settings?.customEntries,includeDisabled,customLessonMap(settings))).flat();
export function validateCustomEntry(value:any){
 if(!value||typeof value!=='object'||Array.isArray(value)||!getLessonMeta(value.lesson))throw Error('請選擇自訂生字的教材與課次。');
 const original={character:value.word?.[value.targetIdx]};
 const fields=validateEntryFields(original,value);
 if(typeof value.enabled!=='boolean')throw Error('請確認是否開放本字。');
 const version=value.version??0;if(!Number.isInteger(version)||version<0)throw Error('自訂生字版本不正確。');
 return {...fields,lesson:value.lesson,enabled:value.enabled,version};
}
export function validateTeachingEntry(id:string,value:any){
 const original=curriculumEntries.find(e=>e.id===id);if(!original)throw Error('找不到本課生字。');
 return validateEntryFields(original,value);
}
function validateEntryFields(original:any,value:any){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('教材格式不正確。');
 const out:any={};for(const [key,max]of Object.entries({word:12,pinyin:100,sentence:300,meaning:300,teachingNote:300,speechWord:40,speechCharacter:12})){
  const field=value[key]??(original as any)[key]??'';if(typeof field!=='string'||field.length>max)throw Error('請確認教材文字長度。');out[key]=field.trim();
 }
 if(!/^[\u3400-\u9fff]{1,8}$/.test(out.word)||!Number.isInteger(value.targetIdx)||value.targetIdx<0||value.targetIdx>=out.word.length||out.word[value.targetIdx]!==original.character)throw Error('語詞須為1至8個國字，並選擇有效的目標生字位置。');out.targetIdx=value.targetIdx;
 const syllables=out.pinyin.split(/\s+/);if(syllables.length!==out.word.length||syllables.some((s:string)=>!/^(?:˙?[ㄅ-ㄩ]{1,3}[ˊˇˋ]?|[ㄅ-ㄩ]{1,3}˙)$/.test(s)))throw Error('每個國字都需要一組注音，各字注音以空格分隔。');out.pinyin=syllables.join(' ');
 if(out.sentence&&!out.sentence.includes('[  ]'))throw Error('例句請用 [  ] 標出語詞位置。');return out;
}
export function wordSpeech(entry:any){return entry?.speechWord?.trim()||entry?.word||'';}
function neutralDeContext(entry:any){
 const targetIdx=entry?.testCharIdx??entry?.targetIdx,syllable=entry?.pinyin?.trim().split(/\s+/)[targetIdx];
 // Keep the neutral-tone 的 in its word context instead of producing 我的的的.
 // This improves the prompt; the selected device voice still decides pronunciation.
 if(entry?.speechCharacter?.trim()||entry?.word?.[targetIdx]!=='的'||!['˙ㄉㄜ','ㄉㄜ˙'].includes(syllable))return '';
 const spokenOverride=entry.speechWord?.trim();
 // An override may add a prefix or replace characters, so its target position is not implied.
 if(spokenOverride&&spokenOverride[targetIdx]!=='的')return '';
 if(entry.word==='的'&&!spokenOverride)return '我的書，第二個字';
 const position=['一','二','三','四','五','六','七','八'][targetIdx]||String(targetIdx+1);
 return `${wordSpeech(entry)}，第${position}個字`;
}
export function targetSpeech(entry:any){return neutralDeContext(entry)||`${wordSpeech(entry)}的${entry?.speechCharacter?.trim()||entry?.word?.[entry.testCharIdx??entry.targetIdx]||''}`;}
export function sentenceText(entry:any){return (entry?.sentence?.trim()||'').replaceAll('[  ]',()=>entry?.word||'');}
export function sentenceSpeech(entry:any){return (entry?.sentence?.trim()||'').replaceAll('[  ]',()=>wordSpeech(entry));}
export function writingSpeech(entry:any){const example=sentenceSpeech(entry),target=neutralDeContext(entry)||`${wordSpeech(entry)}的，${entry.speechCharacter?.trim()||entry.word[entry.testCharIdx??entry.targetIdx]}`;return `${example?example+(/[。！？!?]$/.test(example)?'':'。'):''}請寫出，${target}`;}
export function speechText(text:string,entries:any[]){
 const choices=entries.filter(e=>e.speechWord&&e.speechWord!==e.word).sort((a,b)=>b.word.length-a.word.length);if(!choices.length)return text;
 const map=new Map(choices.map(e=>[e.word,e.speechWord]));const pattern=[...map.keys()].map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');return text.replace(new RegExp(pattern,'g'),w=>map.get(w)||w);
}
