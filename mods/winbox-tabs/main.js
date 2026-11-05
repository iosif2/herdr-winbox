// The shown space's tabs in a strip above its panes, as flat WinBox tabs: the
// program's icon, the name, a spinner or dot for the agent's status, × on the
// shown one, and + for a new terminal or agent (Herdr's new-menu). Click to
// show, double-click to rename, right-click for Herdr's tab menu, drag to
// reorder, scroll to move between tabs.
import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme } from "herdr";
import { icon, stop } from "./shared.js";

export default class Tabs extends View {
  init() { this.pressed = null; }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const shown = space?.tabs ?? [];
    const ps = panes();
    const tab = (c, i) => {
      const program = ps.find((p) => p.tab === c.id && p.program?.agent)?.program ?? ps.find((p) => p.tab === c.id)?.program;
      const name = !c.named && program?.agent ? program.name : c.name;
      return h_flex().id(`wt-${c.id}`).h(24).px(9).gap(6).rounded(4).items_center().flex_none().text_size(12).cursor_pointer()
        .border_1().border_color(c.active ? t.input : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover((s) => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex((x) => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), (el) => el.child(program.tint ? svg(program.icon).size(13).flex_none().text_color(c.active ? t.accent : t.muted) : image(program.icon).w(13).h(13).flex_none()))
        .child(div().max_w(180).truncate().child(c.zoomed ? `${name} ⤢` : name))
        .when(c.status === "working", (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(11).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", (el) => el.child(div().size(6).rounded(3).flex_none().bg(t[c.status])))
        .when(c.active, (el) => el.child(div().id(`wt-x-${c.id}`).ml(2).size(14).flex().items_center().justify_center().rounded(3).text_color(t.dim)
          .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", stop)
          .on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); })
          .child(svg(icon("close")).size(10))));
    };
    return h_flex().size_full().min_w(0).px(8).gap(4).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel((e) => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("wt-scroll").flex_1().min_w(0).h_full().items_center().gap(4).overflow_x_scrollbar().children(shown.map(tab)))
      .child(div().id("wt-new").size(24).flex_none().flex().items_center().justify_center().rounded(4).text_color(t.muted).cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("New terminal or agent").on_mouse_down("left", stop)
        .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))
        .child(svg(icon("plus")).size(14)));
  }
}
