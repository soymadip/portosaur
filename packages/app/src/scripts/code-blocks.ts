/**
 * Code-block frames — vanilla script, imported by BaseLayout on every
 * page.
 *
 * Wraps each Shiki `pre.astro-code` in a `.porto-code-frame` with a
 * header (terminal dots, language label from `data-language`, copy
 * button), recreating the look of Starlight's Expressive Code frames
 * without Expressive Code (Shiki everywhere is a locked decision; the
 * frame CSS lives in `css/code.css`).
 *
 * Runs once the DOM is ready; safe to run twice (already-wrapped
 * blocks are skipped). The copy button falls back to a hidden
 * textarea + execCommand when the Clipboard API is unavailable.
 */

const COPY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function frameCodeBlocks(): void {
  document.querySelectorAll<HTMLPreElement>("pre.astro-code").forEach((pre) => {
    if (pre.closest(".porto-code-frame")) {
      return;
    }

    const frame = document.createElement("div");
    frame.className = "porto-code-frame";

    const header = document.createElement("div");
    header.className = "porto-code-header";

    const dots = document.createElement("span");
    dots.className = "porto-code-dots";
    dots.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "porto-code-dot";
      dots.appendChild(dot);
    }
    header.appendChild(dots);

    const language = pre.getAttribute("data-language");
    if (language) {
      const label = document.createElement("span");
      label.className = "porto-code-lang";
      label.textContent = language;
      header.appendChild(label);
    }

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "porto-code-copy";
    copyButton.setAttribute("aria-label", "Copy code");
    copyButton.innerHTML = `${COPY_ICON}<span>Copy</span>`;
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText);
      } catch {
        // Clipboard API unavailable (non-secure context) — fall
        // back to a hidden textarea + execCommand.
        const textarea = document.createElement("textarea");
        textarea.value = pre.innerText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      copyButton.setAttribute("data-copied", "true");
      copyButton.setAttribute("aria-label", "Copied!");
      copyButton.innerHTML = `${CHECK_ICON}<span>Copied!</span>`;
      window.setTimeout(() => {
        copyButton.removeAttribute("data-copied");
        copyButton.setAttribute("aria-label", "Copy code");
        copyButton.innerHTML = `${COPY_ICON}<span>Copy</span>`;
      }, 1500);
    });
    header.appendChild(copyButton);

    pre.parentNode?.insertBefore(frame, pre);
    frame.appendChild(header);
    frame.appendChild(pre);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", frameCodeBlocks);
} else {
  frameCodeBlocks();
}
