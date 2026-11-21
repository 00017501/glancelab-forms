import type { ConsentContent } from "../api/types";
import { el, mount } from "../lib/dom";

/** The consent text as headed sections. Used on the consent screen and in the "Data we collect" dialog. */
export function consentSections(consent: ConsentContent): HTMLElement {
  const deletion = consent.deletion_date
    ? `All data will be deleted by ${new Date(`${consent.deletion_date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`
    : "";
  const sections: [string, string][] = [
    ["Who is running this study", [consent.organiser, consent.purpose].filter(Boolean).join("\n\n")],
    ["What we collect", consent.collected],
    ["What we do not collect", consent.not_collected],
    ["Taking part is your choice", consent.voluntary],
    ["How your data is used", [consent.anonymity, deletion].filter(Boolean).join(" ")],
    ["Age", consent.age],
    ["Questions", consent.contact],
  ];
  const list = el("div", { class: "consent" });
  for (const [heading, body] of sections) {
    if (!body.trim()) continue;
    list.append(el("section", {}, el("h2", { text: heading }), el("p", { text: body })));
  }
  return list;
}

function openDialog(title: string, body: Node, actions: HTMLElement[]): HTMLDialogElement {
  const dialog = el(
    "dialog",
    { class: "dialog", attrs: { "aria-label": title } },
    el("h1", { class: "dialog-title", text: title }),
    el("div", { class: "dialog-body" }, body),
    el("div", { class: "dialog-actions" }, ...actions),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function showDataDialog(consent: ConsentContent): void {
  const close = el("button", { class: "button button-primary", text: "Close", attrs: { type: "button" } });
  const dialog = openDialog("Data we collect", consentSections(consent), [close]);
  close.addEventListener("click", () => dialog.close());
}

/** Resolves true when the participant confirms they want to leave. */
export function confirmLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    const stay = el("button", { class: "button", text: "Stay", attrs: { type: "button" } });
    const leave = el("button", { class: "button button-danger", text: "Leave and delete", attrs: { type: "button" } });
    const dialog = openDialog(
      "Leave the study?",
      el("p", { text: "Everything you entered will be deleted straight away. You do not need to give a reason." }),
      [stay, leave],
    );
    let confirmed = false;
    leave.addEventListener("click", () => {
      confirmed = true;
      dialog.close();
    });
    stay.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve(confirmed));
  });
}

export interface Footer {
  /** Show or hide "Leave study"; it only makes sense while a session exists. */
  setLeave(handler: (() => void) | null): void;
}

/** The quiet footer present on every screen, hidden only while a timed image is showing. */
export function mountFooter(container: HTMLElement, consent: ConsentContent, previewLabel: string | null): Footer {
  const leave = el("button", { class: "link", text: "Leave study", attrs: { type: "button", hidden: true } });
  let onLeave: (() => void) | null = null;
  leave.addEventListener("click", () => onLeave?.());
  mount(
    container,
    previewLabel ? el("span", { class: "preview-tag", text: previewLabel }) : null,
    el("button", {
      class: "link",
      text: "Data we collect",
      attrs: { type: "button" },
      on: { click: () => showDataDialog(consent) },
    }),
    leave,
  );
  return {
    setLeave: (handler) => {
      onLeave = handler;
      leave.hidden = handler === null;
    },
  };
}

/** A simple centred message, used for every end state. */
export function showMessage(display: HTMLElement, title: string, body: string, extra?: Node): void {
  mount(
    display,
    el(
      "main",
      { class: "page page-centred" },
      el("h1", { class: "page-title", text: title }),
      el("p", { class: "lead", text: body }),
      extra,
    ),
  );
}

export function setConnectionNotice(isDown: boolean): void {
  let notice = document.getElementById("connection-notice");
  if (isDown && !notice) {
    notice = el("div", {
      class: "notice",
      text: "Connection lost. Trying again…",
      attrs: { id: "connection-notice", role: "status" },
    });
    document.body.append(notice);
  } else if (!isDown && notice) {
    notice.remove();
  }
}
