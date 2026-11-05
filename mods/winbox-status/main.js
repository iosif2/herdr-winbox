// The status bar along the bottom, as WinBox's: this computer's name, then
// "ip / arch / model / OS / herdr-app version", CPU %, memory (used / free /
// total; used is active + wired + compressed, as Activity Monitor counts it), uptime and a clock with seconds. The facts come from one shell
// script every 5 s; the clock and uptime tick every second without it.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, theme, updates } from "herdr";
import { icon } from "./shared.js";

const SCRIPT = String.raw`
os=$(uname -s); arch=$(uname -m)
if [ "$os" = Darwin ]; then
  name=$(scutil --get ComputerName 2>/dev/null || hostname -s)
  ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
  model=$(sysctl -n hw.model); ver="macOS $(sw_vers -productVersion 2>/dev/null)"
  ncpu=$(sysctl -n hw.ncpu); total=$(sysctl -n hw.memsize); pagesz=$(sysctl -n hw.pagesize)
  used=$(vm_stat | awk -v p="$pagesz" '/Pages active/ {a=$3+0} /Pages wired down/ {w=$4+0} /Pages occupied by compressor/ {c=$5+0} END {print (a+w+c)*p}')
  free=$(( total - used ))
  boot=$(sysctl -n kern.boottime | sed -n 's/^{ sec = \([0-9]*\),.*/\1/p')
else
  name=$(hostname -s); ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  model=$(cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null); ver=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")
  ncpu=$(nproc); total=$(awk '/MemTotal/ {print $2*1024}' /proc/meminfo); free=$(awk '/MemAvailable/ {print $2*1024}' /proc/meminfo)
  boot=$(( $(date +%s) - $(cut -d. -f1 /proc/uptime) ))
fi
cpu=$(ps -A -o %cpu= | awk '{s+=$1} END {printf "%d", s}')
printf 'name=%s\nip=%s\narch=%s\nmodel=%s\nver=%s\nncpu=%s\ntotal=%s\nfree=%s\nboot=%s\ncpu=%s\n' "$name" "$ip" "$arch" "$model" "$ver" "$ncpu" "$total" "$free" "$boot" "$cpu"
`;

const mib = (b) => `${(Number(b) / 1048576).toFixed(1)} MiB`;
const pad2 = (n) => String(n).padStart(2, "0");
function uptime(boot) {
  if (!boot) return "";
  let s = Math.max(0, Math.floor(Date.now() / 1000) - Number(boot));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
function clock() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export default class Status extends View {
  init(_props, cx) {
    this.facts = {};
    this.read(cx);
    cx.timer.every(5000, (cx) => this.read(cx));
    cx.timer.every(1000, (cx) => cx.notify());
  }

  read(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec("sh", ["-c", SCRIPT]);
        if (r.code === 0) this.facts = Object.fromEntries(r.stdout.split("\n").filter((l) => l.includes("=")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
      } catch {}
      cx.notify();
    });
  }

  render() {
    const t = theme(), f = this.facts;
    const item = (glyph, text, strong = false) => h_flex().flex_none().gap(5).items_center()
      .child(svg(icon(glyph)).size(13).flex_none().text_color(t.muted))
      .child(div().truncate().when(strong, (el) => el.font_semibold().text_color(t.foreground)).child(text));
    const about = [f.ip, f.arch, f.model, f.ver, `herdr-app ${updates().app.version}`].filter(Boolean).join(" / ");
    const cpu = f.cpu && f.ncpu ? `${Math.min(100, Math.round(Number(f.cpu) / Number(f.ncpu)))} %` : "…";
    const mem = f.total && f.free ? `${mib(Number(f.total) - Number(f.free))} / ${mib(f.free)} / ${mib(f.total)}` : "…";
    return h_flex().size_full().px(10).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.5).text_color(t.muted)
      .child(h_flex().gap(6).items_center().min_w(0).child(item("host", f.name ?? "…", true)).child(div().truncate().child(about)))
      .child(item("cpu", cpu))
      .child(item("memory", mem))
      .child(item("uptime", uptime(f.boot)))
      .child(item("clock", clock()));
  }
}
