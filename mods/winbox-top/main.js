// The bar across the top, as WinBox's: "Workspace:" and the shown space as a
// drop-down chip (opens Herdr's picker), a search button (the command palette),
// then on the right the pills (agents working in green, a ready update in blue,
// agents that need you in red), ‹ › between agents, and the settings gear.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, run, theme, updates } from "herdr";
import { icon, pill, stop } from "./shared.js";

export default class Top extends View {
  button(t, id, glyph, tip, onClick) {
    return div().id(id).size(24).flex_none().flex().items_center().justify_center().rounded(4).text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).on_mouse_down("left", stop).on_click(onClick)
      .child(svg(icon(glyph)).size(15));
  }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const ag = agents();
    const working = ag.filter((a) => a.status === "working").length;
    const needs = ag.filter((a) => a.status === "blocked");
    const up = updates();
    return h_flex().size_full().px(10).gap(8).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(12)
      .child(div().flex_none().text_color(t.muted).child("Workspace:"))
      .child(h_flex().id("workspace").h(22).w(150).pl(8).pr(5).gap(6).items_center().rounded(4).bg(t.raised).border_1().border_color(t.input).cursor_pointer()
        .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click(() => run("mod.open", { name: "picker" }))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(space?.name ?? "<none>"))
        .child(svg(icon("chevron-down")).size(12).flex_none().text_color(t.dim)))
      .child(this.button(t, "search", "search", "Commands", () => run("app.palette")))
      .child(div().flex_1())
      .when(needs.length > 0, (el) => el.child(pill(t, "needs", `${needs.length} need${needs.length === 1 ? "s" : ""} you`, t.blocked, () => run("agent.focus", { terminal: needs[0].address }))))
      .child(pill(t, "working", working ? `${working} working` : `${ag.length} agent${ag.length === 1 ? "" : "s"}`, t.done, () => run("mod.open", { name: "picker" })))
      .when(Boolean(up.app.ready), (el) => el.child(pill(t, "update", `Herdr ${up.app.ready} ready`, t.accent, () => run("app.update"))))
      .child(h_flex().gap(2).items_center().ml(4)
        .child(this.button(t, "prev", "undo", "Previous agent", () => run("agent.prev")))
        .child(this.button(t, "next", "redo", "Next agent", () => run("agent.next"))))
      .child(div().w(1).h(16).mx(4).bg(t.border))
      .child(this.button(t, "settings", "settings", "Settings", () => run("app.settings")));
  }
}
