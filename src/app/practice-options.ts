export const PRACTICE_LIMITS=[0,3,5,8,10,15,20];
export function practiceItems<T>(items:T[],settings:{practiceLimit?:number;practiceOrder?:string}={},random=Math.random):T[]{
 const result=[...items];
 if(settings.practiceOrder!=='lesson')for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 const count=settings.practiceLimit??0;
 return count>0?result.slice(0,count):result;
}
export const WRITING_PRESETS=[
 {id:'guided',name:'完整引導',description:'先看完整字 3 秒，再用淡色底字與筆順引導。',settings:{maskMode:'off',writingMode:'guided',writingHint:'pale',writingObserveSeconds:3,allowMoreHint:true,allowPale:true,allowNextStroke:true,allowAnimation:true,allowFullCharacter:true,autoStrokeHint:true}},
 {id:'recall',name:'看後回想',description:'先看 3 秒，遮住後最多揭示 2 次部件。',settings:{maskMode:'component',observeSeconds:3,revealLimit:2,allowFullCharacter:true}},
 {id:'independent',name:'獨立書寫',description:'直接自由書寫，不提供字形或筆順提示。',settings:{maskMode:'off',writingMode:'free',writingHint:'none',writingObserveSeconds:0,allowMoreHint:false,allowPale:false,allowNextStroke:false,allowAnimation:false,allowFullCharacter:false,autoStrokeHint:false}},
];
