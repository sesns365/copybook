"use client";
import React, {useId, useState} from 'react';

// 小小的「？」：平常只佔一個圓圈，點了才展開說明，避免畫面被小字塞滿。
export default function HelpTip({children, label = '說明'}: {children: React.ReactNode; label?: string}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <>
    <button type="button" aria-expanded={open} aria-controls={id} aria-label={open ? `收起${label}` : `看${label}`} title={open ? '收起說明' : '看說明'}
      onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
      className={'ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border align-middle text-xs font-bold leading-none ' + (open ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-400 bg-white text-slate-600 hover:border-blue-600 hover:text-blue-800')}>？</button>
    {open && <span id={id} role="note" className="mt-1 block basis-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-normal text-slate-700">{children}</span>}
  </>;
}
