import {parseSettingsTemplates,selectTemplateFields,type SettingsTemplate} from './settings-templates';
import {normalisePromptRules,readCopybookTemplates,writeCopybookTemplate} from './copybook-local';

export const TEMPLATE_FILE_MAX_BYTES=2*1024*1024;
export const TEMPLATE_LIMIT=40;
export type TemplateKind='teaching'|'copybookPrompt';
export type PortableTemplate={name:string;categories?:string[];patch?:SettingsTemplate['patch'];rules?:Record<string,any>};
export type TemplateFile={format:'character-writing-templates';version:1;kind:TemplateKind;exportedAt:string;templates:PortableTemplate[]};
const object=(v:any)=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exactKeys=(value:any,keys:string[])=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const canonical=(value:any):string=>JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

function validatePortableTemplate(value:any,kind:TemplateKind):PortableTemplate{
 const max=kind==='teaching'?60:40;
 if(!exactKeys(value,kind==='teaching'?['name','categories','patch']:['name','rules'])||typeof value.name!=='string'||!value.name.trim()||value.name.length>max)throw Error('範本名稱或欄位格式不正確。');
 if(kind==='teaching'){
  const parsed=parseSettingsTemplates(JSON.stringify([{id:'import',created:'2000-01-01T00:00:00.000Z',source:'匯入範本',...value}]))[0];
  // A backup must describe exactly the chosen categories; do not silently drop other settings.
  if(canonical(parsed.patch)!==canonical(value.patch))throw Error('教學範本的設定與勾選類別不符，請重新匯出。');
  return {name:value.name.trim(),categories:[...new Set(parsed.categories)].sort(),patch:parsed.patch};
 }
 const rules=normalisePromptRules(value.rules);
 if(!Object.keys(rules).length||canonical(rules)!==canonical(value.rules))throw Error('提示範本需包含有效的提示順序，最多 20 次。');
 return {name:value.name.trim(),rules};
}

export function portableTemplate(record:any,kind:TemplateKind):PortableTemplate{
 return validatePortableTemplate(kind==='teaching'?{name:record.name,categories:record.categories,patch:selectTemplateFields(record.patch,record.categories)}:{name:record.name,rules:record.rules},kind);
}
export function templateContentKey(record:any,kind:TemplateKind){const value=portableTemplate(record,kind);return canonical(kind==='teaching'?{categories:value.categories,patch:value.patch}:value.rules)}
export function createTemplateFile(records:any[],kind:TemplateKind):TemplateFile{
 if(!records.length||records.length>TEMPLATE_LIMIT)throw Error('每份備份請選擇 1 至 40 個範本。');
 const file:TemplateFile={format:'character-writing-templates',version:1,kind,exportedAt:new Date().toISOString(),templates:records.map(record=>portableTemplate(record,kind))};
 if(new TextEncoder().encode(JSON.stringify(file)).length>TEMPLATE_FILE_MAX_BYTES)throw Error('範本備份最多 2 MB，請減少勾選後分批匯出。');
 return file;
}
export function parseTemplateFile(raw:string,kind:TemplateKind):TemplateFile{
 if(new TextEncoder().encode(raw).length>TEMPLATE_FILE_MAX_BYTES)throw Error('範本備份最多 2 MB。');
 let file:any;try{file=JSON.parse(raw)}catch{throw Error('無法讀取範本備份，請選擇匯出的 JSON 檔案。')}
 if(!exactKeys(file,['format','version','kind','exportedAt','templates'])||file.format!=='character-writing-templates'||file.version!==1||file.kind!==kind||typeof file.exportedAt!=='string'||!Number.isFinite(Date.parse(file.exportedAt))||!Array.isArray(file.templates)||!file.templates.length||file.templates.length>TEMPLATE_LIMIT)throw Error('備份類型或版本不正確，請選擇這一類範本的備份。');
 return {...file,templates:file.templates.map((record:any)=>validatePortableTemplate(record,kind))};
}
export function readTemplateDestination(storage:Storage,kind:TemplateKind,destination:string):any[]{return kind==='teaching'?parseSettingsTemplates(storage.getItem(destination)):readCopybookTemplates(storage,destination)}
export function planTemplateImport(existing:any[],incoming:PortableTemplate[],kind:TemplateKind){
 const signatures=new Set(existing.map(record=>templateContentKey(record,kind))),names=new Set(existing.map(record=>record.name)),max=kind==='teaching'?60:40;
 return incoming.map(record=>{
  const key=templateContentKey(record,kind);if(signatures.has(key))return {template:record,duplicate:true};
  signatures.add(key);let name=record.name,index=1;
  while(names.has(name)){const suffix=index===1?'（匯入）':`（匯入 ${index}）`;name=record.name.slice(0,max-suffix.length)+suffix;index++}
  names.add(name);return {template:{...record,name},duplicate:false};
 });
}
export function importTemplateSelection(storage:Storage,kind:TemplateKind,destination:string,incoming:PortableTemplate[]){
 if(!destination)throw Error('請重新開啟班級後使用範本。');
 const existing=readTemplateDestination(storage,kind,destination),validated=incoming.map(record=>validatePortableTemplate(record,kind)),plan=planTemplateImport(existing,validated,kind),added=plan.filter(row=>!row.duplicate).map(row=>row.template);
 if(existing.length+added.length>TEMPLATE_LIMIT)throw Error('此類範本最多 40 個，請減少勾選或先刪除不需要的範本。');
 if(!added.length)return {added:0,skipped:plan.length,records:existing};
 const now=Date.now(),records=added.map(record=>kind==='teaching'?{...record,id:crypto.randomUUID(),created:new Date(now).toISOString(),source:'匯入範本'}:{...record,id:crypto.randomUUID(),updatedAt:now});
 if(kind==='teaching')storage.setItem(destination,JSON.stringify([...existing,...records]));
 else{
  const written:string[]=[];
  try{for(const record of records){writeCopybookTemplate(storage,destination,record);written.push(destination+'template:'+record.id)}}
  catch(error){for(const key of written)try{storage.removeItem(key)}catch{}throw Error('儲存空間不足或瀏覽器無法保存範本，請重新讀取清單後再試；相同內容會略過。')}
 }
 return {added:records.length,skipped:plan.length-records.length,records:[...existing,...records]};
}
