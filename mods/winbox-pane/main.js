// Each pane's title bar, as a WinBox window's: the program's icon and name,
// the folder, the agent's status, and on hover the split, zoom and close buttons.
import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";
import { icon, stop } from "./shared.js";

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class PaneTitle extends View {
  init() { this.hovered = false; }

  button(t, id, glyph, command, args) {
    return div().id(id).size(20).flex().items_center().justify_center().rounded(3).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", stop)
      .on_click((_e, cx) => { cx.stop_propagation(); run(command, args); })
      .child(svg(icon(glyph)).size(13));
  }

  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = p.program?.icon ? (p.program.tint ? svg(p.program.icon).size(13).flex_none().text_color(t.accent) : image(p.program.icon).w(13).h(13).flex_none()) : null;
    const st = p.status, pane = p.pane;
    return h_flex().id(`wb-head-${pane}`).size_full().px(8).gap(7).items_center().bg(p.focused ? t.raised : t.surface).border_b(1).border_color(t.border).text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(240).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", (el) => el.child(h_flex().flex_none().px(6).h(16).items_center().rounded(3).bg(t.blocked).text_size(10.5).font_semibold().text_color("#ffffff").child("Needs you")))
      .when(st === "done", (el) => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, (el) => el
        .child(this.button(t, `wb-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `wb-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `wb-z-${pane}`, "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `wb-x-${pane}`, "close", "pane.close", { pane })));
  }
}
