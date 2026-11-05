// Bits the four WinBox mods share: icon paths, space colors (the same rule as
// Herdr's own lists, so every mod agrees), a layout node finder and the side
// panel toggle.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, shared, setShared, layout, run } from "herdr";

export const icon = (name) => `mods/winbox-side/icons/${name}.svg`;

const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColors() {
  const ids = new Set(spaces().map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
  for (const p of spaces()) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = PROJECT_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    changed = true;
  }
  if (changed) setShared("space.colors", kept);
  return kept;
}
export function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = spaceColors()[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
}

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The right side panel (Files, Changes): open it on `id`, switch to it, or close it when shown.
export function panelOn(id) {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  return Boolean(panel && !panel.hidden && body?.active === id);
}
export function togglePanel(id) {
  const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
  if (!panel || !body?.children?.some((c) => c.id === id)) return;
  if (!panel.hidden && body.active === id) run("layout.hide", { id: "panel" });
  else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
}

// Presses on controls must not start a window drag.
export const stop = (_e, cx) => cx.stop_propagation();

// A WinBox pill: solid color, white bold text.
export function pill(t, id, text, color, onClick) {
  return h_flex().id(id).h(20).px(9).items_center().rounded(4).flex_none().bg(color).text_size(11.5).font_semibold().text_color("#ffffff")
    .cursor_pointer().hover((s) => s.opacity(0.85)).on_mouse_down("left", stop).on_click(onClick).child(text);
}

export const dot = (color) => div().size(6).rounded(3).flex_none().bg(color);
