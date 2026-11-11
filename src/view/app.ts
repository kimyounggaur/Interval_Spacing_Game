import { commonBySemis, letterCells, nameKo, noteEn, noteKo, spellings, isSimple } from "../theory";
import { derivation, rulerFor, commonName } from "../game/generator";
import {
  ROUTES,
  ROUTE_IDS,
  earLevel,
  routeItems,
  routeMastered,
  routeUnlocked,
  runStars,
} from "../game/planner";
import type { GameState, Route, Ticket } from "../game/types";
import type { AudioState } from "../audio/engine";
import { buildStage } from "./stage";
import { popoSvg, svgIcon } from "./assets";

const esc = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const btn = (action: string, text: string, cls = "outline"): string =>
  `<button class="${cls}" data-action="${action}">${text}</button>`;
const icon = (action: string, label: string, name: Parameters<typeof svgIcon>[0]): string =>
  `<button class="icon-btn" data-action="${action}" aria-label="${label}">${svgIcon(name)}</button>`;
const head = (title: string): string =>
  `<header class="page-head">${icon("back", "뒤로", "back")}<h2 tabindex="-1">${title}</h2>${icon("notebook", "음정 수첩", "notebook")}${icon("settings", "설정", "settings")}</header>`;
const stamp = (value: number | undefined): string => (value === 2 ? "●" : value === 1 ? "◐" : "○");
const kindNames: Record<Ticket["kind"], string> = {
  degree: "도수 승차권",
  semitone: "반음 연습권",
  read: "읽기 승차권",
  make: "만들기 승차권",
  ear: "소리 승차권",
};
export function createView(root: HTMLElement) {
  root.innerHTML = `<div id="screen" class="shell" data-screen="title"><div id="pages"></div><section id="run" class="run" aria-label="기차 운전" hidden>
    <header class="hud"><span id="hud-title" class="hud-title"></span><div id="hud-dots" class="hud-dots" aria-label="승차권 진행"></div><button data-action="sound" id="sound-chip" class="sound-chip">소리 켜기</button>${icon("pause", "일시정지", "pause")}</header>
    <section id="ticket" class="ticket" aria-label="승차권"><div class="ticket-stripe"></div><div class="ticket-main"><span id="ticket-kind" class="ticket-kind"></span><strong id="ticket-title" class="ticket-title"></strong><span id="ticket-sub" class="ticket-sub"></span></div><div class="ticket-stub"><small>출발</small><b id="ticket-from"></b></div></section>
    <div id="run-stage-slot" class="stage-slot"><div id="stage"></div><div id="ear-panel" class="ear-panel" hidden><div id="ear-direction" class="ear-direction"><p>두 번째 음은 어떻게 움직였나요?</p><div class="row">${btn("direction-up", "위로 ↑", "primary")}${btn("direction-down", "아래로 ↓", "outline")}</div></div><div id="ear-choices" class="ear-choices"></div></div></div>
    <div id="readout" class="readout"></div><div id="controls" class="controls"><button data-control="0" aria-label="한 칸 아래로">◀</button><button data-control="1">도착!</button><button data-control="2" aria-label="한 칸 위로">▶</button></div>
    <div class="subrow"><button data-action="assist" id="assist">세기 도움 켜짐</button><button data-action="replay" id="replay">출발음 듣기</button><button data-action="next" id="next" class="next" hidden>다음 승차권 →</button></div></section></div>
    <div id="live" class="sr" aria-live="polite" aria-atomic="true"></div><div id="toast" class="toast" role="status" hidden></div><dialog id="modal" class="modal" aria-labelledby="modal-title"></dialog><div class="rotation"><h2>세로 화면으로 돌려 주세요</h2><p>모든 역과 운전 단추를 함께 볼 수 있어요.</p></div>`;
  const el = <T extends HTMLElement = HTMLElement>(id: string): T =>
    root.querySelector<T>(`#${id}`)!;
  const stage = buildStage(el("stage"));
  const pages = el("pages"),
    run = el("run"),
    dialog = el<HTMLDialogElement>("modal");
  const controls = Array.from(el("controls").querySelectorAll<HTMLButtonElement>("button"));
  const dots = Array.from({ length: 12 }, () => {
    const dot = document.createElement("span");
    dot.className = "hud-dot";
    el("hud-dots").append(dot);
    return dot;
  });
  const earButtons = Array.from({ length: 12 }, () => {
    const b = document.createElement("button");
    b.dataset.action = "choose";
    el("ear-choices").append(b);
    return b;
  });
  let currentScreen = "";
  let currentModal: string | null = null;
  let previousFocus: HTMLElement | null = null;
  let lastLive = "";
  let lastReadout = "";
  let announcedTicket: Ticket | null = null;
  let announcedPosition = -1;
  let renderedSettings: GameState["save"]["settings"] | null = null;
  function render(state: GameState, audioState: AudioState, offline: boolean, dragging = false) {
    root.dataset.motion = state.save.settings.motion;
    document.documentElement.dataset.motion = state.save.settings.motion;
    el("screen").dataset.screen = state.screen;
    if (state.screen !== currentScreen) {
      // Move the retained stage out before replacing a screen that may contain it.
      el("run-stage-slot").prepend(stage.element);
      currentScreen = state.screen;
      renderedSettings = null;
      pages.hidden = state.screen === "run";
      run.hidden = state.screen !== "run";
      if (state.screen !== "run") pages.innerHTML = screenTemplate(state);
      if (state.screen === "title") pages.querySelector("[data-stage-slot]")!.append(stage.element);
      const heading = pages.querySelector<HTMLElement>("h2,h1");
      if (state.screen !== "run") heading?.focus({ preventScroll: true });
    }
    const slot = state.screen === "title";
    stage.render({
      ticket: slot ? null : state.ticket,
      pos: slot ? 12 : state.pos,
      fpos: slot ? 12 : state.fpos,
      phase: slot ? "drive" : state.phase,
      assist: slot || state.save.settings.assist,
      reveal: state.reveal,
      route: slot ? "intro" : (state.run?.route ?? "intro"),
      dragging,
      tunnel: !slot && state.ticket?.kind === "ear" && !state.hunt && state.phase !== "verify",
    });
    el("sound-chip").hidden = audioState === "running" && !state.save.settings.muted;
    el("sound-chip").textContent = state.save.settings.muted
      ? "음소거 중"
      : audioState === "unavailable"
        ? "소리 미지원"
        : "소리 켜기";
    if (state.screen === "run" && state.ticket && state.run) {
      const t = state.ticket;
      el("hud-title").textContent =
        state.tutorial === 10
          ? "반음 운전 연습"
          : state.tutorial !== null
            ? "포포와 연습"
            : ROUTES[state.run.route].title;
      dots.forEach((dot, i) => {
        dot.hidden = i >= state.run!.plan.length;
        dot.className = `hud-dot ${state.run!.results[i] === 2 ? "full" : state.run!.results[i] === 1 ? "half" : i === state.run!.index ? "current" : ""}`;
        dot.setAttribute("aria-label", `${i + 1}번 ${stamp(state.run!.results[i])}`);
      });
      el("hud-dots").setAttribute(
        "aria-label",
        `${state.run.results.length}/${state.run.plan.length}장 도착`,
      );
      el("ticket").dataset.kind = t.kind;
      el("ticket").dataset.phase = state.phase;
      el("ticket-kind").textContent = kindNames[t.kind];
      el("ticket-title").textContent = t.title;
      el("ticket-sub").textContent = t.sub;
      el("ticket-from").textContent = noteKo(t.startNote);
      const message = readout(state);
      el("readout").textContent = message;
      el("readout").className =
        `readout ${state.phase === "verify" ? "ok" : state.mistakes && state.message ? "no" : ""}`;
      const stationName =
        state.phase === "verify"
          ? noteKo(t.targetNote)
          : state.pos === t.start
            ? noteKo(t.startNote)
            : spellings(48 + state.pos, 1)
                .filter(isSimple)
                .map(noteKo)
                .join(" / ");
      const announcement =
        announcedTicket !== t
          ? `${t.title}. ${noteKo(t.startNote)}에서 출발해요. ${message}`
          : announcedPosition !== state.pos
            ? `${stationName} 역. ${message}`
            : lastReadout !== message
              ? message
              : lastLive;
      if (lastLive !== announcement) {
        el("live").textContent = announcement;
        lastLive = announcement;
      }
      lastReadout = message;
      announcedTicket = t;
      announcedPosition = state.pos;
      const listening = t.kind === "ear" && !state.hunt && state.phase === "judge";
      el("ear-panel").hidden = !listening;
      el("ear-direction").hidden = state.earDirectionAnswered;
      el("ear-choices").hidden = !state.earDirectionAnswered;
      earButtons.forEach((b, i) => {
        const label = t.choices[i];
        b.hidden = !label;
        b.textContent = label ?? "";
        b.dataset.choice = label ?? "";
        b.disabled = !listening || !state.earDirectionAnswered;
      });
      const reading = t.kind === "read" && state.phase === "judge";
      el("controls").classList.toggle("choices", reading);
      controls.forEach((b, i) => {
        if (reading) {
          b.textContent = t.choices[i] ?? "";
          b.dataset.choice = t.choices[i] ?? "";
          b.disabled = !t.choices[i];
          b.removeAttribute("aria-label");
        } else {
          delete b.dataset.choice;
          b.disabled =
            state.phase === "show" ||
            state.phase === "brief" ||
            (i !== 1 && (state.phase !== "drive" || listening));
          b.textContent =
            i === 0
              ? "◀"
              : i === 2
                ? "▶"
                : state.phase === "fix"
                  ? "다시 운전"
                  : state.phase === "verify"
                    ? "다시 듣기"
                    : listening
                      ? "다시 듣기"
                      : "도착!";
          if (i !== 1) b.setAttribute("aria-label", i === 0 ? "한 칸 아래로" : "한 칸 위로");
        }
      });
      el("assist").textContent = listening
        ? "귀로 찾아가기"
        : state.save.settings.assist
          ? "세기 도움 켜짐"
          : "세기 도움 꺼짐";
      el("assist").setAttribute("aria-pressed", String(state.save.settings.assist && !listening));
      el("replay").hidden = state.phase === "verify";
      el("replay").textContent = t.kind === "ear" ? "다시 듣기" : "출발음 듣기";
      el("next").hidden = state.phase !== "verify";
      el("next").textContent =
        state.tutorial === 10
          ? state.run.index === 0
            ? "온음도 세어 볼까요 →"
            : "이제 기본 노선으로 →"
          : state.tutorial !== null
            ? "연습 끝, 출발해요 →"
            : state.run.index + 1 === state.run.plan.length
              ? "종착역으로 →"
              : "다음 승차권 →";
    }
    const off = pages.querySelector("#offline");
    if (off)
      off.textContent = offline ? "오프라인 준비 완료" : "온라인 실행 중 · 오프라인 준비 확인 중";
    if (state.screen === "settings" && renderedSettings !== state.save.settings) {
      renderedSettings = state.save.settings;
      for (const input of pages.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-setting]",
      )) {
        const value =
          state.save.settings[input.dataset.setting as keyof typeof state.save.settings];
        if (input instanceof HTMLInputElement && input.type === "checkbox")
          input.checked = Boolean(value);
        else input.value = String(value);
      }
    }
    if (state.modal !== currentModal) {
      currentModal = state.modal;
      if (!currentModal) {
        if (dialog.open) dialog.close();
        previousFocus?.focus({ preventScroll: true });
      } else {
        previousFocus =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.innerHTML = modalTemplate(state);
        if (!dialog.open) dialog.showModal();
        dialog.querySelector<HTMLElement>("button")?.focus();
      }
    }
  }
  function refreshScreens() {
    currentScreen = "";
  }
  return {
    render,
    stage,
    refreshScreens,
    announce: (text: string) => {
      el("live").textContent = text;
    },
    toast: (text: string) => {
      el("toast").textContent = text;
      el("toast").hidden = false;
      window.setTimeout(() => {
        el("toast").hidden = true;
      }, 4500);
    },
  };
}
function screenTemplate(state: GameState): string {
  if (state.screen === "title")
    return `<section class="page hero"><header class="hero-top"><span class="brand">도레미 기차 여행</span><div class="row">${icon("notebook", "음정 수첩", "notebook")}${icon("settings", "설정", "settings")}</div></header><div class="hero-copy"><span class="eyebrow">한 역씩, 귀와 눈으로</span><h1 tabindex="-1">음정 정거장</h1><p>기차를 직접 몰며<br>두 음 사이의 거리를 발견해요.</p></div><div data-stage-slot></div><div class="hero-actions">${btn("routes", "출발하기 " + svgIcon("play"), "primary")}${state.save.activeRun ? btn("resume", "하던 여행 이어하기", "secondary") : btn("tutorial", "포포와 운전 연습", "outline")}</div><span class="hero-foot">소리 · 도수 · 반음이 하나로 이어지는 여행</span></section>`;
  if (state.screen === "routes")
    return `<section class="page">${head("오늘은 어느 노선으로?")}<div class="route-intro">${popoSvg("default")}<div><p>한 역씩 움직이며 직접 세어 봐요.</p><span class="small muted">● 혼자 도착 · ◐ 도움받아 도착</span></div></div><div class="routes">${ROUTE_IDS.map(
      (id, i) => {
        const route = ROUTES[id],
          items = routeItems(id, state.save),
          count = items.filter((key) => state.save.mastery[key]?.stamp === 2).length,
          open = routeUnlocked(id, state.save);
        return `<button class="route" data-action="start-${id}" ${open ? "" : "disabled"}><span class="route-num">${i + 1}</span><span><strong>${route.title}${id === "ear" ? ` · ${earLevel(state.save)}단계` : ""}</strong><p>${open ? route.subtitle : id === "ear" ? "기본 노선에서 별 1개를 모으면 열려요" : "기본·청음 노선에서 별 1개씩 모으면 열려요"}</p><span class="small muted">승차권 ${route.length}장${id === "ear" ? " · 소리가 필요해요" : ""}</span></span><span class="route-stars">${"★".repeat(state.save.routes[id].stars)}${"☆".repeat(3 - state.save.routes[id].stars)}<small>${routeMastered(id, state.save) ? "완주 배지" : `● ${count}/${items.length}`}</small></span></button>`;
      },
    ).join(
      "",
    )}</div>${state.save.activeRun ? `<div class="stack" style="margin-top:18px">${btn("resume", "하던 여행 이어하기", "secondary")}</div>` : ""}</section>`;
  if (state.screen === "settings")
    return `<section class="page settings">${head("여행 설정")}<div class="panel stack"><div class="setting"><label for="volume">소리 크기</label><input id="volume" data-setting="volume" aria-label="소리 크기" type="range" min="0" max="1" step="0.05"></div>${(["muted", "vibration", "assist"] as const).map((key, i) => `<div class="setting"><label for="${key}">${["음소거", "진동", "세기 도움 기본값"][i]}</label><input id="${key}" data-setting="${key}" type="checkbox"></div>`).join("")}<div class="setting"><label for="motion">화면 움직임</label><select id="motion" data-setting="motion"><option value="system">기기 설정 따르기</option><option value="reduced">동작 줄이기</option><option value="full">모두 보기</option></select></div>${btn("sound-test", "소리 확인하기", "secondary")}${btn("tutorial", "포포와 운전 연습 다시 하기")}${btn("reset-confirm", "저장 데이터 초기화", "outline danger")}<p id="offline" class="notice"></p><p class="small muted">개인정보를 수집하지 않아요. 진행 상황은 이 브라우저에 저장돼요.</p></div></section>`;
  if (state.screen === "notebook")
    return `<section class="page">${head("음정 수첩")}<div class="notice" style="margin-bottom:16px">도수는 글자 수, 반음은 구간 수예요.<br>같은 반음 수에도 철자가 다르면 이름이 달라져요.</div><div class="notebook-wrap"><table class="notebook"><thead><tr><th>반음</th><th>도수 · 이름</th><th>읽기</th><th>만들기</th><th>듣기</th><th>소리</th></tr></thead><tbody>${Array.from(
      { length: 12 },
      (_, i) => {
        const ivs = commonBySemis(i + 1);
        return `<tr><td>${i + 1}칸</td><td>${ivs.map((iv) => `${iv.num}도 · ${nameKo(iv)}`).join("<br>")}</td>${["read", "make", "ear"].map((kind) => `<td>${ivs.map((iv) => stamp(state.save.mastery[`${kind}:${iv.quality}${iv.num}`]?.stamp)).join(" ")}</td>`).join("")}<td><button data-action="example" data-semi="${i + 1}" aria-label="${commonName(i + 1)} 듣기">${svgIcon("play", 18)}</button></td></tr>`;
      },
    ).join(
      "",
    )}</tbody></table></div><div class="panel stack" style="margin-top:16px"><h3>두 이름, 같은 역</h3><p>도 → 레♯는 증2도, 도 → 미♭는 단3도예요. 소리는 같아도 글자 수가 달라요.</p><p class="small muted">대표곡 후보는 강사 검수 전이에요. 지금은 정확한 두 음의 음정만 들려줘요.</p><p class="small muted">가온 도: ${noteEn({ letter: 0, acc: 0, octave: 4 })} · 261.63Hz</p></div></section>`;
  if (state.screen === "terminus" && state.run) {
    const r = state.run,
      clean = r.results.filter((x) => x === 2).length,
      stars = runStars(r.results, r.assistOff);
    return `<section class="page">${head("종착역 도착")}<div class="result"><div class="confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--tx:${(i - 12) * 18}px;--rot:${i * 47}deg;--delay:${(i % 4) * 35}ms;--piece:${["#e77b43", "#2e7d5b", "#c69722", "#2b3a5c"][i % 4]}"></i>`).join("")}</div>${popoSvg("happy")}<span class="eyebrow">${ROUTES[r.route].title} · 여행 완료</span><h1>잘 다녀왔어요!</h1><div class="result-stars" aria-label="별 ${stars}개">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div><div class="panel"><div class="stamps" aria-label="이번 운행 스탬프">${r.results.map((x) => `<span>${stamp(x)}</span>`).join("")}</div><div class="result-stats"><div><strong>${r.results.length}</strong><span>도착한 승차권</span></div><div><strong>${clean}</strong><span>혼자 도착 ●</span></div><div><strong>${r.results.length - clean}</strong><span>도움받아 도착 ◐</span></div></div></div><p>우리가 지나온 역이 하나의 선율이 됐어요.</p>${btn("melody", "이번 여행 선율 듣기 " + svgIcon("play"), "secondary")}<div class="row">${btn(`start-${r.route}`, "다시 운행하기", "primary")}${btn("routes", "다른 노선 둘러보기")}</div><p class="small muted">전부 ●이면 별 2개, 세기 도움도 끄고 완주하면 별 3개예요.</p></div></section>`;
  }
  return "";
}
function readout(state: GameState): string {
  const t = state.ticket!;
  if (state.phase === "verify")
    return `${state.run?.results.at(-1) === 2 ? "정답! ●" : "도착! ◐"} ${derivation(t)}`;
  if (state.phase === "fix" || state.phase === "show" || (state.mistakes && state.message))
    return state.message;
  if (state.tutorial !== null && state.tutorial < 10) {
    if (state.pos < 14) return "포포: 기차를 오른쪽으로 밀어 보세요. 도 → 레 → 미!";
    if (state.pos < 16) return "출발역 도가 ①이에요. 레는 ②, 미는 ③이에요.";
    return "도·레·미, 3도만큼 왔어요. 도착!을 눌러 보세요.";
  }
  if (t.kind === "ear" && !state.hunt)
    return state.earDirectionAnswered
      ? "두 음 사이의 음정 이름을 골라 주세요."
      : "두 번째 음이 올라갔나요, 내려갔나요?";
  if (state.phase === "judge") return `글자 ${t.num}개 · 반음 ${t.iv.semis}칸. 어떤 음정일까요?`;
  if (t.respelled && state.pos === t.start) return state.message;
  if (!state.save.settings.assist) return "소리와 역 이름으로 직접 세어 보세요.";
  if (state.pos === t.start)
    return t.kind === "degree"
      ? "출발역이 ①이에요. 흰 역을 하나씩 세며 운전하세요."
      : "역 번호 = 글자 수 · 깡충 = 반음 수예요.";
  const cells = letterCells(t.startNote, t.dir, t.start, state.pos);
  const count = cells.length;
  const exact = cells.at(-1)?.cell === state.pos;
  if (t.kind === "degree")
    return exact ? `흰 역 ${count}개째 → ${count}도` : `터널을 지나고 있어요 · 흰 역 ${count}개`;
  const label = spellings(48 + state.pos, 1)
    .filter(isSimple)
    .map(noteKo)
    .join(" / ");
  return `${label} · ${exact ? `글자 ${count}개` : `글자 ${count}~${count + 1}개 사이`} · 반음 ${Math.abs(state.pos - t.start)}칸`;
}
function modalTemplate(state: GameState): string {
  if (state.modal === "ruler")
    return `<h2 id="modal-title">이 승차권의 음정 자</h2><p>${esc(rulerFor(state.ticket!))}</p><p class="small muted">음정 자를 쓰면 이번 승차권은 ◐ 스탬프예요.</p>${btn("close", "운전으로 돌아가기", "primary")}`;
  if (state.modal === "reset")
    return `<h2 id="modal-title">처음부터 다시 여행할까요?</h2><p>이 브라우저에 저장된 별, 스탬프, 운행 기록이 초기화돼요.</p><div class="row">${btn("close", "돌아가기")}${btn("reset", "초기화하기", "secondary")}</div>`;
  if (state.modal === "sound-check")
    return `<h2 id="modal-title">소리가 들리나요?</h2><div class="popo-intro">${popoSvg("default")}<p>가온 도를 들어 보세요.<br>기차가 지나가는 역마다 소리가 나요.</p></div><div class="stack">${btn("sound-test", "다시 듣기", "secondary")}<div class="row">${btn("sound-yes", "들려요", "primary")}${btn("sound-no", "안 들려요")}</div>${btn("skip-tutorial", "연습 건너뛰기")}</div>`;
  if (state.modal === "sound-help")
    return `<h2 id="modal-title">소리를 확인해 봐요</h2><p>휴대전화의 미디어 음량과 무음 스위치를 확인해 주세요. 다른 앱에서 돌아왔다면 소리 켜기를 눌러 보세요.</p><p>도수·읽기·만들기는 소리 없이도 할 수 있어요.</p><div class="row">${btn("sound-yes", "계속 연습하기", "primary")}${btn("sound-test", "다시 듣기")}</div>`;
  return `<h2 id="modal-title">잠시 쉬어 갈까요?</h2><p>지금까지의 운행은 자동으로 저장돼요.</p><div class="stack">${btn("close", "계속 운전하기", "primary")}${btn("ruler", "이번 승차권 음정 자")}${btn("notebook", "음정 수첩")}${btn("settings", "설정")}${btn("routes", "노선도로 돌아가기")}${state.tutorial !== null ? btn("skip-tutorial", "연습 건너뛰기") : ""}</div>`;
}
export type AppView = ReturnType<typeof createView>;
export type { Route };
