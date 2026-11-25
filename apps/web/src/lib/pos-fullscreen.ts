'use client';
import { useLocalState } from './local-store';

/** POS full-screen mode hides the sidebar and top bar. Remembered per device. */
export function usePosFullscreen() {
  return useLocalState<boolean>('hk_pos_fullscreen', false);
}
