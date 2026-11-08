// At 50% on white, this red matches the original #f4a5a5 writing grid.
export const DEFAULT_ASSESSMENT_GRID_OPACITY=.5;
export function assessmentGridOpacity(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:DEFAULT_ASSESSMENT_GRID_OPACITY;}
export function assessmentGridStyle(value:unknown,legacyColor='#f4a5a5'){
 // Historical sessions have no opacity field. Preserve their original rendering.
 return value===undefined?{stroke:legacyColor,strokeOpacity:1}:{stroke:'#e94b4b',strokeOpacity:assessmentGridOpacity(value)};
}
export function assessmentGridLabel(value:unknown){const opacity=assessmentGridOpacity(value);return opacity===0?'不顯示':`${Math.round(opacity*100)}%${opacity===DEFAULT_ASSESSMENT_GRID_OPACITY?'（原預設濃淡）':''}`;}
