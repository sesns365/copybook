'use client';
import {createContext,type ReactNode} from 'react';
export const Curriculum=createContext<any>({});
export function CurriculumTitleProvider({title,settings,children}:{title?:string;settings?:any;children:ReactNode}){
 return <Curriculum.Provider value={settings||{customTitle:title}}>{children}</Curriculum.Provider>;
}
