'use client';
import {useContext} from 'react';
import {BOOKS,getBook,getLessonMeta} from './curriculum-source';
import {Curriculum} from './CurriculumContext';
export {CurriculumTitleProvider} from './CurriculumContext';
export function useCurriculum(includeDeleted=false){const settings=useContext(Curriculum);return {settings,getBook:(id?:string)=>getBook(id,settings,includeDeleted),getLessonMeta:(id:string)=>getLessonMeta(id,settings),books:BOOKS.map(b=>getBook(b.id,settings,includeDeleted))};}
export function useLessonTitle(){const {getLessonMeta}=useCurriculum();return (id:string)=>{const l=getLessonMeta(id);return l?l.title+('deleted' in l&&l.deleted?'（已刪除）':''):id;};}
export function useLessonLabel(){const {getBook,getLessonMeta}=useCurriculum(),title=useLessonTitle();return (id:string)=>{const l=getLessonMeta(id);return l?`${getBook(l.bookId).label}・${l.number?'第'+l.number+'課 ':''}${title(id)}`:id==='review'?'錯題複習':id;};}
