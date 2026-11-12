import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000;

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const newBar = document.querySelector('[data-testid="new-bar"]');
const acked = new Set();
const shown = new Set();
let latest = [];

// Viewer's own zone and locale order (R5): en-GB/de-DE put the day first, en-US the month.
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

function row(i) {
  const li = document.createElement('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = i.id;
  li.innerHTML = `<span class="id"></span><span class="sev"></span><span class="what"></span><time></time><span class="act"></span>`;
  li.querySelector('.id').textContent = i.id;
  li.querySelector('.act').append(acked.has(i.id) ? ackedMark() : ackButton(i.id));
  return li;
}

function ackButton(id) {
  const button = document.createElement('button');
  button.dataset.testid = 'ack';
  button.textContent = 'Ack';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await ack(id);
      acked.add(id);
      button.replaceWith(ackedMark());
    } catch (err) {
      console.error(err);
      button.disabled = false;
    }
  });
  return button;
}

function ackedMark() {
  const mark = document.createElement('span');
  mark.dataset.testid = 'acked';
  mark.className = 'acked';
  mark.textContent = 'acked';
  return mark;
}

// Keyed by id, so rows keep their Ack state and focus across refreshes. The list holds still while it is
// on screen: incidents that arrive later wait behind the "N new" bar until on-call brings them in.
function render() {
  const visible = latest.filter((i) => shown.has(i.id));
  const existing = new Map([...list.children].map((li) => [li.dataset.id, li]));
  visible.forEach((i, index) => {
    const li = existing.get(i.id) ?? row(i);
    existing.delete(i.id);
    li.className = `row ${i.severity}`;
    li.querySelector('.sev').textContent = i.severity;
    li.querySelector('.what').textContent = `${i.service} · ${i.region} · ${i.summary}`;
    const time = li.querySelector('time');
    time.dateTime = i.openedAt;
    time.textContent = timeFormat.format(new Date(i.openedAt));
    if (list.children[index] !== li) list.insertBefore(li, list.children[index] ?? null);
  });
  existing.forEach((li) => li.remove());
  empty.hidden = visible.length > 0;
  const waiting = latest.length - visible.length;
  newBar.hidden = waiting === 0;
  newBar.textContent = `${waiting} new incident${waiting === 1 ? '' : 's'} · show`;
}

newBar.addEventListener('click', () => {
  latest.forEach((i) => shown.add(i.id));
  render();
});

async function refresh() {
  try {
    latest = (await fetchIncidents()).incidents;
    if (loader.isConnected) latest.forEach((i) => shown.add(i.id));
    render();
    loader.remove();
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(refresh, REFRESH_MS);
  }
}

refresh();
