/**
 * Shared layout constants.
 *
 * `TAB_CLEARANCE` is the bottom padding a scroll view needs so its last item
 * clears the floating BottomNav (≈64px tall) with breathing room, added on top
 * of the safe-area inset. One value so every scroller stops the same distance
 * above the tab bar (the shell used 112, Nutrition 96 — that drift is what this
 * fixes). Use as `paddingBottom: insets.bottom + TAB_CLEARANCE`.
 */
export const TAB_CLEARANCE = 112
