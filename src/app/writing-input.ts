export type WritingInputMode = 'all' | 'pen';

// Pointer filtering applies only to ink/paint surfaces, never native controls or assembly.
// Missing settings keep older lessons and saved assessment snapshots on normal input.
export function acceptsWritingPointer(mode: unknown, event: {pointerType?: string}) {
 return mode !== 'pen' || event.pointerType === 'pen';
}

export const WRITING_PEN_NOTICE = '此田字格只接收觸控筆書寫或塗色；手指仍可按按鈕與拖曳組部件。需使用瀏覽器可辨識的觸控筆。';
