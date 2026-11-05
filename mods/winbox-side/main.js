// The WinBox menu column: the brand row at the top (props.role "brand", beside
// the window buttons), and under it every space as a menu item with a › that
// unfolds its tabs, then the fixed items (New Terminal, New Space, Files,
// Changes, any extra panels the layout names in props.extra, Agents, Commands,
// Settings). Click a space or a tab to go there,
// right-click for Herdr's own menu.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, run, theme, props, openOverlay, window, nextCommand } from "herdr";
import { icon, spaceColor, panelOn, togglePanel, stop } from "./shared.js";

const ROW = 24;

export default class Side extends View {
  init(_props, cx) {
    this.open = new Set(JSON.parse(localStorage.getItem("open") ?? "[]"));
    // Keys open a panel as its menu item does: "cmd-g": "winbox-side.graph" in keys.json toggles
    // the panel child called "graph" (files and changes likewise).
    if (props()?.role === "menu") cx.spawn(async (cx) => { for (;;) { togglePanel(await nextCommand()); cx.notify(); } });
  }

  fold(id, cx) {
    if (this.open.has(id)) this.open.delete(id); else this.open.add(id);
    localStorage.setItem("open", JSON.stringify([...this.open]));
    cx.notify();
  }

  // One menu row: a 16px icon, a label, and on the right a chevron or a status mark.
  row(t, id, glyph, label, { on = false, color = null, indent = 0, chevron = null, mark = null, click = null, right = null, onChevron = null } = {}) {
    return h_flex().id(id).h(ROW).flex_none().pl(8 + indent).pr(6).gap(7).items_center().text_size(12.5).cursor_pointer()
      .text_color(on ? t.foreground : t.muted).when(on, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_mouse_down("left", stop).on_click((_e, cx) => click?.(cx))
      .when(Boolean(right), (el) => el.on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); right(cx); }))
      .child(svg(icon(glyph)).size(16).flex_none().text_color(color ?? t.accent))
      .child(div().flex_1().min_w(0).truncate().child(label))
      .when(Boolean(mark), (el) => el.child(mark))
      .when(Boolean(chevron), (el) => el.child(div().id(`${id}-chev`).size(16).flex_none().flex().items_center().justify_center().rounded(3).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { cx.stop_propagation(); onChevron?.(cx); })
        .child(svg(icon(chevron)).size(12).text_color(t.dim))));
  }

  mark(t, status) {
    if (status === "working") return svg("mods/workspace-chrome/spinner.svg").size(11).flex_none().text_color(t.working).spin(900);
    if (status === "blocked" || status === "done") return div().size(6).rounded(3).flex_none().bg(t[status]);
    return null;
  }

  brand(t) {
    const mac = window()?.platform === "macos" && window().titlebar === "none" && !window().fullscreen;
    return h_flex().size_full().pl(mac ? 78 : 10).gap(6).items_center().bg(t.chrome).border_b(1).border_r(1).border_color(t.border)
      .child(svg(icon("logo")).size(15).flex_none().text_color(t.foreground))
      .child(div().text_size(12).font_semibold().text_color(t.foreground).child("herdr"));
  }

  render() {
    const t = theme();
    const role = props()?.role;
    if (role === "brand") return this.brand(t);
    const ag = agents();
    const rows = [];
    for (const s of spaces()) {
      // The shown space's tabs are always unfolded; the others fold and unfold by their chevron.
      const many = s.tabs.length > 1, open = many && (s.active || this.open.has(s.id));
      rows.push(this.row(t, `sp-${s.id}`, "box", s.name, {
        on: s.active && !open, color: spaceColor(t, s),
        chevron: many ? (open ? "chevron-down" : "chevron-right") : null, onChevron: (cx) => this.fold(s.id, cx),
        mark: this.mark(t, s.status),
        click: () => run("space.select", { id: s.id }),
        right: () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }),
      }));
      if (!open) continue;
      for (const c of s.tabs) {
        const a = ag.find((x) => x.tab === c.id && x.program?.agent);
        rows.push(this.row(t, `tab-${c.id}`, "terminal", a?.program?.name && !c.named ? a.program.name : c.name, {
          on: s.active && c.active, indent: 16, color: t.dim, mark: this.mark(t, c.status),
          click: () => run("tab.select", { id: c.id }),
          right: () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: s.id } } }),
        }));
      }
    }
    const fixed = [
      ["new-terminal", "terminal", "New Terminal", () => run("tab.new"), false],
      ["new-space", "plus", "New Space", () => run("space.new"), false],
      ["files", "folder", "Files", () => togglePanel("files"), panelOn("files")],
      ["changes", "changes", "Changes", () => togglePanel("changes"), panelOn("changes")],
      // More panels a layout adds to panel-body: props.extra = [{ id, label, icon }].
      ...(props()?.extra ?? []).filter((x) => x?.id && x.label).map((x) => [x.id, x.icon ?? "box", x.label, () => togglePanel(x.id), panelOn(x.id)]),
      ["agents", "agents", "Agents", () => run("mod.open", { name: "picker" }), false],
      ["commands", "commands", "Commands", () => run("app.palette"), false],
      ["settings", "settings", "Settings", () => run("app.settings"), false],
    ];
    const tools = fixed.map(([id, glyph, label, click, on]) => this.row(t, id, glyph, label, { on, click }));
    // role "tools": only the fixed items, for a layout that puts something else (the agents list) between them and the spaces.
    if (role === "tools") return v_flex().size_full().bg(t.chrome).border_r(1).border_color(t.border).py(4)
      .child(div().mx(8).mb(4).h(1).flex_none().bg(t.border)).children(tools);
    return v_flex().size_full().bg(t.chrome).border_r(1).border_color(t.border).py(4)
      .child(v_flex().id("winbox-spaces").flex_1().min_h(0).overflow_y_scrollbar().children(rows))
      // props.fixed === false leaves the fixed items to a "tools" copy.
      .when(props()?.fixed !== false, (el) => el.child(div().mx(8).my(4).h(1).flex_none().bg(t.border)).children(tools));
  }
}
