// The WinBox menu column: the brand row at the top (props.role "brand", beside
// the window buttons), and under it every space as a menu item with a › that
// unfolds its tabs, then the fixed items (New Terminal, New Space, Files,
// Changes, any extra panels the layout names in props.extra, Agents, Commands,
// Settings). Click a space or a tab to go there,
// right-click for Herdr's own menu. Once another machine is known (`hc machine ls`,
// temporary ones skipped) the spaces are grouped under a header per machine, this
// computer first: click the header to fold it, + starts a space there; a machine
// that isn't connected shows its state, one that needs a login offers the command
// to copy. Add Machine at the end opens Herdr's machine-add dialog.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, agents, run, hc, theme, props, openOverlay, window, nextCommand } from "herdr";
import { icon, spaceColor, panelOn, togglePanel, stop } from "./shared.js";

const ROW = 24;

export default class Side extends View {
  init(_props, cx) {
    this.open = new Set(JSON.parse(localStorage.getItem("open") ?? "[]"));
    try { this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]")); } catch { this.folded = new Set(); }
    this.machines = []; // hc machine ls, without temporary ones
    this.copied = null;
    if (props()?.role !== "brand" && props()?.role !== "tools") {
      this.refreshMachines(cx);
      cx.timer.every(15000, (cx) => this.refreshMachines(cx));
    }
    // Keys open a panel as its menu item does: "cmd-g": "winbox-side.graph" in keys.json toggles
    // the panel child called "graph" (files and changes likewise).
    if (props()?.role === "menu") cx.spawn(async (cx) => { for (;;) { togglePanel(await nextCommand()); cx.notify(); } });
  }

  fold(id, cx) {
    if (this.open.has(id)) this.open.delete(id); else this.open.add(id);
    localStorage.setItem("open", JSON.stringify([...this.open]));
    cx.notify();
  }

  refreshMachines(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["machine", "ls", "--json"]);
        if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary);
      } catch {}
      cx.notify();
    });
  }

  foldMachine(key, cx) {
    if (this.folded.has(key)) this.folded.delete(key); else this.folded.add(key);
    localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
    cx.notify();
  }

  // A machine's header: its name (or "This computer"), its state when it isn't
  // connected, and + for a new space there.
  machineHead(t, m, { state, connected, folded, count }) {
    const key = m ?? "local";
    return h_flex().id(`machine-${key}`).h(22).flex_none().mt(m ? 6 : 0).pl(8).pr(6).gap(6).items_center().text_size(11).text_color(t.dim).cursor_pointer()
      .hover((s) => s.text_color(t.muted)).on_mouse_down("left", stop).on_click((_e, cx) => this.foldMachine(key, cx))
      .tooltip(m ? `${m} · ${state.replace(/_/g, " ")}` : "This computer")
      .child(svg(icon(folded ? "chevron-right" : "chevron-down")).size(10).flex_none())
      .child(svg(icon(m ? "machine" : "host")).size(13).flex_none().text_color(connected ? t.muted : t.dim))
      .child(div().flex_1().min_w(0).truncate().font_semibold().child(m ?? "This computer"))
      .when(folded && count > 0, (el) => el.child(div().flex_none().child(String(count))))
      .when(!connected, (el) => el.child(div().flex_none().text_color(state === "needs_login" ? t.blocked : t.dim).child(state.replace(/_/g, " "))))
      .when(connected, (el) => el.child(div().id(`machine-new-${key}`).size(16).flex_none().flex().items_center().justify_center().rounded(3)
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(`New space on ${m ?? "this computer"}`)
        .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); })
        .child(svg(icon("plus")).size(11))));
  }

  spaceRows(t, s, ag, rows) {
    // The shown space's tabs are always unfolded; the others fold and unfold by their chevron.
    const many = s.tabs.length > 1, open = many && (s.active || this.open.has(s.id));
    rows.push(this.row(t, `sp-${s.id}`, "box", s.name, {
      on: s.active && !open, color: spaceColor(t, s),
      chevron: many ? (open ? "chevron-down" : "chevron-right") : null, onChevron: (cx) => this.fold(s.id, cx),
      mark: this.mark(t, s.status),
      click: () => run("space.select", { id: s.id }),
      right: () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }),
    }));
    if (!open) return;
    for (const c of s.tabs) {
      const a = ag.find((x) => x.tab === c.id && x.program?.agent);
      rows.push(this.row(t, `tab-${c.id}`, "terminal", a?.program?.name && !c.named ? a.program.name : c.name, {
        on: s.active && c.active, indent: 16, color: t.dim, mark: this.mark(t, c.status),
        click: () => run("tab.select", { id: c.id }),
        right: () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: s.id } } }),
      }));
    }
  }

  // Every space, under a header per machine once one isn't this computer.
  spaceList(t) {
    const ag = agents(), all = spaces(), docs = machines();
    const rows = [];
    const remote = [...new Set([...all.map((s) => s.machine).filter(Boolean), ...this.machines.map((m) => m.name)])].sort();
    if (!remote.length) {
      for (const s of all) this.spaceRows(t, s, ag, rows);
      return rows;
    }
    for (const m of [null, ...remote]) {
      const mine = all.filter((s) => (s.machine ?? null) === m);
      const info = m ? this.machines.find((k) => k.name === m) : null;
      const doc = docs.find((k) => k.name === m)?.layout;
      const state = !m ? "connected" : info?.state ?? (doc === "ready" ? "connected" : doc === "loading" ? "connecting" : "asleep");
      const connected = state === "connected";
      const key = m ?? "local", folded = this.folded.has(key);
      rows.push(this.machineHead(t, m, { state, connected, folded, count: mine.length }));
      if (folded) continue;
      if (state === "needs_login") {
        const cmd = `hc machine login ${m}`;
        rows.push(this.row(t, `machine-login-${key}`, "terminal", this.copied === cmd ? "Copied — run it in a terminal" : cmd, {
          indent: 8, color: t.blocked, click: (cx) => { cx.write_to_clipboard(cmd); this.copied = cmd; cx.notify(); },
        }));
      }
      if (!mine.length && doc === "loading") rows.push(h_flex().id(`machine-loading-${key}`).h(ROW).flex_none().pl(31).items_center().text_size(12).text_color(t.dim).child("Loading…"));
      else if (!mine.length && connected) rows.push(this.row(t, `machine-empty-${key}`, "plus", "New Space", { color: t.dim, click: () => run("space.new", { machine: m ?? "" }) }));
      for (const s of mine) this.spaceRows(t, s, ag, rows);
    }
    return rows;
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
    const rows = role === "tools" ? [] : this.spaceList(t);
    rows.push(this.row(t, "machine-add", "machine", "Add Machine", { color: t.dim, click: () => openOverlay({ mod: "machine-add", kind: "dialog", width: 560 }) }));
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
