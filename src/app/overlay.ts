/**
 * The two things the shell draws itself: taking the boot veil away, and the
 * error page (in the game's voice, with the technical detail folded away).
 * Self-contained styles: this must work when everything else has not.
 */

/** Fade the "Lighting the candles" veil out and remove it. */
export function hideVeil(): void {
  const veil = document.getElementById('veil');
  if (!veil) return;
  veil.classList.add('is-lit');
  window.setTimeout(() => veil.remove(), 1000);
}

const LINES = {
  boot: {
    head: 'The candles would not light.',
    body: 'The table is laid and the realm is on it, but something in the room has refused to start. Your saved reign has not been touched.',
  },
  frame: {
    head: 'The realm has stopped mid-step.',
    body: 'Something went awry and the clerks have put down their pens. The reign was saved where it stood, as far as anyone could manage.',
  },
} as const;

/** Show the error page. Safe to call more than once: the first report stays. */
export function showError(err: unknown, where: keyof typeof LINES): void {
  if (document.getElementById('ll-error')) return;
  document.getElementById('veil')?.remove();
  const e = err instanceof Error ? err : new Error(String(err));
  const detail = `${e.name}: ${e.message}\n${e.stack ?? ''}`.slice(0, 4000);

  const box = document.createElement('div');
  box.id = 'll-error';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-labelledby', 'll-error-h');
  box.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:24px;'
    + 'background:rgba(14,10,8,.88);font-family:\'IM Fell English\',\'Hoefler Text\',Georgia,serif;overflow:auto';

  const card = document.createElement('div');
  card.style.cssText = 'max-width:520px;width:100%;color:#2a1d14;background:linear-gradient(#efe3c4,#e6d6ae);border:1px solid #b89f6c;'
    + 'border-radius:3px;padding:28px 30px 22px;box-shadow:0 18px 50px rgba(0,0,0,.6),0 1px 0 rgba(255,250,235,.5) inset';

  const h = document.createElement('h1');
  h.id = 'll-error-h';
  h.textContent = LINES[where].head;
  h.style.cssText = 'margin:0 0 10px;font:400 26px/1.15 \'IM Fell English SC\',\'IM Fell English\',Georgia,serif;color:#7c1f1b';

  const p = document.createElement('p');
  p.textContent = LINES[where].body;
  p.style.cssText = 'margin:0 0 18px;font-size:17px;line-height:1.4';

  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'Light them again';
  again.style.cssText = 'font:400 17px \'IM Fell English SC\',Georgia,serif;color:#efe3c4;background:#9e2b25;border:1px solid #7c1f1b;'
    + 'border-radius:3px;padding:8px 18px;cursor:pointer';
  again.addEventListener('click', () => location.reload());

  const fold = document.createElement('details');
  fold.style.cssText = 'margin-top:18px;font-size:14px;color:#5a4633';
  const sum = document.createElement('summary');
  sum.textContent = 'What the clerk wrote down';
  sum.style.cssText = 'cursor:pointer';
  const pre = document.createElement('pre');
  pre.textContent = detail;
  pre.style.cssText = 'margin:10px 0 0;padding:10px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;'
    + 'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#2a1d14;background:rgba(42,29,20,.08);border-radius:3px;user-select:text';
  fold.append(sum, pre);

  card.append(h, p, again, fold);
  box.append(card);
  document.body.append(box);
  again.focus();
}
