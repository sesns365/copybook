// Keep document-wide defaults, but never carry another lesson's word-specific edits or layout.
export function reuseCopybookSettings(options:Record<string,any>){
 const {items,manualColumns,...defaults}=options;
 return {...defaults,items:{},titleCustom:false};
}
