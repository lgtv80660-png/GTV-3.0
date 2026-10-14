"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

type Action = "up" | "down" | "left" | "right" | "ok" | "back";
const controls = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
const groups = '.live-competition-rail, .live-category-list, .live-channel-list, .live-match-list-compact';
const editable = (el: Element | null) => Boolean(el?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest('[inert], [aria-hidden="true"]');

export function readGamepadAction(pad: Gamepad): Action | null {
  // Only the browser's standard mapping is portable between Xbox and PlayStation.
  if (pad.mapping !== "standard") return null;
  const pressed = (i: number) => Boolean(pad.buttons[i]?.pressed);
  if (pressed(1)) return "back";
  if (pressed(0)) return "ok";
  if (pressed(12)) return "up";
  if (pressed(13)) return "down";
  if (pressed(14)) return "left";
  if (pressed(15)) return "right";
  const x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.55) return null;
  return Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");
}

export function useLiveNavigation(rootRef: RefObject<HTMLDivElement | null>, showChannels: boolean, backToCategories: () => void) {
  const state = useRef({ showChannels, backToCategories });
  useLayoutEffect(() => { state.current = { showChannels, backToCategories }; });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let navigationMode = false;
    let last: HTMLElement | null = null;
    let lastGroup = "";
    let lastIndex = 0;
    let categoryId: string | null = null;
    let pendingCategory = false;
    let frame = 0;
    let held: Action | null = null;
    let nextRepeat = 0;
    let keyboardHeld: Action | null = null;
    let keyboardNext = 0;

    const playerOwnsFocus = () => {
      const player = root.querySelector<HTMLElement>(".live-player-frame > div");
      return Boolean(document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        player?.style.position === "fixed" ||
        document.activeElement?.closest(".live-player-frame"));
    };
    const candidates = (scope: Element = root) => Array.from(scope.querySelectorAll<HTMLElement>(controls))
      .filter(el => el.tabIndex >= 0 && visible(el) && !el.closest(".live-player-frame"));
    const remember = (el: HTMLElement) => {
      last = el;
      const group = el.closest<HTMLElement>(groups);
      lastGroup = group ? Array.from(group.classList).find(name => groups.includes(`.${name}`)) ?? "" : "";
      lastIndex = group ? candidates(group).indexOf(el) : 0;
      if (el.dataset.liveCategory) categoryId = el.dataset.liveCategory;
    };
    const focus = (el?: HTMLElement | null) => {
      if (!el) return false;
      navigationMode = true;
      root.dataset.liveNavigation = "true";
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      remember(el);
      return true;
    };
    const restore = () => {
      if (!navigationMode || playerOwnsFocus() || !visible(root)) return;
      if (last?.isConnected && visible(last) && document.activeElement === last) return;
      // Do not steal focus from another part of the application or a search field.
      if (document.activeElement !== document.body && document.activeElement !== root &&
          document.activeElement !== last && document.activeElement?.isConnected) return;
      if (pendingCategory) {
        const items = candidates(root.querySelector(".live-category-list") ?? root);
        const target = items.find(el => el.dataset.liveCategory === categoryId) ?? items[0];
        if (target) { pendingCategory = false; focus(target); }
        return;
      }
      const group = lastGroup && root.querySelector(`.${lastGroup}`);
      const items = group ? candidates(group) : [];
      const browser = root.querySelector(".live-browser");
      focus(items[Math.max(0, Math.min(lastIndex, items.length - 1))] ??
        (browser ? candidates(browser)[0] : candidates()[0]));
    };
    const dispatch = (action: Action): boolean => {
      if (!visible(root) || playerOwnsFocus()) return false;
      const active = document.activeElement as HTMLElement | null;
      if (editable(active)) {
        if (action !== "back") return false;
        return focus(root.querySelector<HTMLElement>(".live-browser button"));
      }
      if (active && active !== document.body && !root.contains(active)) return false;
      const items = candidates();
      if (!items.length) return false;
      navigationMode = true;
      root.dataset.liveNavigation = "true";
      if (action === "back") {
        if (active?.closest(".live-broadcast-channel-list")) {
          return focus(active.closest("article")?.querySelector(".live-match-select-compact"));
        }
        if (active?.closest(".live-match-list-compact")) {
          return focus(root.querySelector<HTMLElement>(".live-competition-item.is-active"));
        }
        if (active?.closest(".live-sport")) {
          return focus(root.querySelector<HTMLElement>(".live-browser button"));
        }
        if (state.current.showChannels) {
          pendingCategory = true;
          state.current.backToCategories();
          return true;
        }
        return false;
      }
      if (!active || !items.includes(active)) return focus(items[0]);
      if (action === "ok") { active.click(); return true; }
      const group = active.closest(groups);
      const card = active.closest(".live-match-card-compact");
      if (card && action === "right" && active.matches(".live-match-select-compact")) {
        const broadcast = card.querySelector<HTMLElement>(".live-broadcast-channel");
        if (broadcast) return focus(broadcast);
      }
      if (card && (action === "left" || action === "right") && active.matches(".live-broadcast-channel")) {
        const broadcasts = candidates(card).filter(el => el.matches(".live-broadcast-channel"));
        const next = broadcasts[broadcasts.indexOf(active) + (action === "left" ? -1 : 1)];
        if (next) return focus(next);
        if (action === "left") return focus(card.querySelector<HTMLElement>(".live-match-select-compact"));
      }
      const horizontal = group?.matches(".live-competition-rail");
      const along = horizontal ? action === "left" || action === "right" : action === "up" || action === "down";
      if (group && along) {
        const matchList = group.matches(".live-match-list-compact");
        const siblings = candidates(group).filter(el => !matchList || el.matches(".live-match-select-compact"));
        const anchor = matchList ? card?.querySelector<HTMLElement>(".live-match-select-compact") : active;
        const index = anchor ? siblings.indexOf(anchor) : -1;
        const next = siblings[index + (action === "up" || action === "left" ? -1 : 1)];
        if (next) return focus(next);
        if (horizontal) return true; // No wrapping or escape at a rail's ends.
      }
      const a = active.getBoundingClientRect();
      const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
      let target: HTMLElement | undefined;
      let score = Infinity;
      for (const item of items) {
        if (item === active || (group && item.closest(groups) === group)) continue;
        const b = item.getBoundingClientRect();
        const dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
        const primary = action === "right" ? dx : action === "left" ? -dx : action === "down" ? dy : -dy;
        const secondary = action === "left" || action === "right" ? Math.abs(dy) : Math.abs(dx);
        if (primary > 1 && primary + secondary * 3 < score) {
          target = item; score = primary + secondary * 3;
        }
      }
      if (target) focus(target);
      return true; // Arrow at an edge belongs to UI, never to player volume/zapping.
    };
    const keyAction = (event: KeyboardEvent): Action | undefined => {
      const keys: Record<string, Action> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Enter: "ok", Select: "ok", Accept: "ok", OK: "ok", Escape: "back", Back: "back", Backspace: "back", BrowserBack: "back", GoBack: "back" };
      return keys[event.key] ?? ([4, 461, 10009].includes(event.keyCode) ? "back" : undefined);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || playerOwnsFocus()) return;
      const target = event.target as HTMLElement | null;
      if (editable(target)) {
        // A TV Back/Escape can leave text entry; Backspace and cursor keys edit it.
        if (["Escape", "Back", "BrowserBack", "GoBack"].includes(event.key) && dispatch("back")) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
        return;
      }
      if (event.key === "Tab") { navigationMode = true; root.dataset.liveNavigation = "true"; return; }
      const action = keyAction(event);
      if (!action) return;
      if (target && target !== document.body && !root.contains(target)) return;
      const now = performance.now();
      const repeat = event.repeat && keyboardHeld === action;
      if (repeat && (action === "ok" || action === "back" || now < keyboardNext)) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (dispatch(action)) {
        keyboardHeld = action; keyboardNext = now + (repeat ? 140 : 380);
        event.preventDefault();
        // Installed once before the dynamically mounted player: its window capture
        // listener must not also interpret a page navigation key as volume/zapping.
        event.stopImmediatePropagation();
      }
    };
    const keyup = () => { keyboardHeld = null; };
    const pointer = () => { navigationMode = false; delete root.dataset.liveNavigation; };
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (root.contains(target) && !target.closest(".live-player-frame")) {
        remember(target);
        if (navigationMode) target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    const pads = () => {
      try { return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => Boolean(p?.connected && p.mapping === "standard")); }
      catch { return []; }
    };
    const tick = (time: number) => {
      frame = 0;
      if (document.hidden || !document.hasFocus()) { held = null; return; }
      const connected = pads();
      if (!connected.length) { held = null; return; }
      const action = connected.map(readGamepadAction).find(Boolean) ?? null;
      if (!action) held = null;
      else if (action !== held) {
        held = action; nextRepeat = time + 380; dispatch(action);
      } else if (action !== "ok" && action !== "back" && time >= nextRepeat) {
        nextRepeat = time + 140; dispatch(action);
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; held = null; keyboardHeld = null;
      if (!document.hidden && document.hasFocus() && pads().length) frame = requestAnimationFrame(tick);
    };
    const observer = new MutationObserver(restore);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    root.addEventListener("pointerdown", pointer, true);
    root.addEventListener("focusin", onFocus);
    window.addEventListener("gamepadconnected", sync);
    window.addEventListener("gamepaddisconnected", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      delete root.dataset.liveNavigation;
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
      root.removeEventListener("pointerdown", pointer, true);
      root.removeEventListener("focusin", onFocus);
      window.removeEventListener("gamepadconnected", sync);
      window.removeEventListener("gamepaddisconnected", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [rootRef]);
}
