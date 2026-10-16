import type { Ref } from 'vue'
import type { PromoEditor } from './usePromoEditor'

/**
 * The layout editor's keyboard shortcuts, wherever the layout is edited:
 * Ctrl/⌘ Z and Shift Z undo and redo, and Ctrl/⌘ [ and ] move the selected
 * layer down or up — with Shift, all the way to the back or the front.
 */
export function usePromoShortcuts(editor: PromoEditor, locked: Ref<boolean>) {
  return function shortcut(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    if (event.code === 'BracketRight' || event.code === 'BracketLeft') {
      if (locked.value || !editor.selected.value) return
      event.preventDefault()
      const forward = event.code === 'BracketRight'
      if (event.shiftKey) editor.moveToEdge(forward ? 'front' : 'back')
      else editor.move(forward ? 1 : -1)
      return
    }
    if (event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
  }
}
