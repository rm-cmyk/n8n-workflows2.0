/* Browser-Test Europapokal: Ligaphase live spielen, Tabellen- und K.-o.-Ansichten, Saisonabschluss */
const { chromium } = require('playwright'); const path = require('path');
const SHOTS = process.env.SHOTS || '';
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const click = async (sel) => { await page.click(sel, { timeout: 5000 }); };
  const toastErr = async (where) => { const t = await page.textContent('#toast'); if (/schiefgegangen/.test(t || '')) errors.push(where + ': ' + t); };
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { const UI = FM.UI; UI.world = FM.World.create({ clubId: 'FCB', manager: 'Europa-Test', seed: 11 }); FM.R.use(UI.world); UI.go('office'); });
  await shot('e1-office');
  // bis zum ersten Europapokal-Abend vorspulen
  const toEuro = async () => page.evaluate(() => { const w = FM.UI.world; let g = 0; for (;;) { const st = FM.Game.nextStep(w); if ((st.kind === 'slot' && st.userItem && st.userItem.kind === 'euro') || st.kind === 'seasonEnd' || g++ > 400) return st.kind + ':' + (st.userItem ? st.userItem.label : ''); FM.Game.advanceAuto(w, true); } });
  console.log('nächster Schritt:', await toEuro());
  await page.evaluate(() => FM.UI.go('office')); await shot('e2-office-before-euro');
  await click('.top [data-a="next"]'); await toastErr('next'); await shot('e3-prematch');
  if (await page.$('[data-a="fixLineup"]')) await click('[data-a="fixLineup"]');
  await click('[data-a="kickoff"]'); await page.waitForSelector('.ticker'); await click('[data-a="liveSpeed"][data-v="3"]');
  for (let g = 0; g < 4000; g++) {
    if (await page.$('[data-a="toReport"]')) break;
    if (await page.$('.modal')) { if (await page.$('.modal [data-a="subDo"]')) await click('.modal [data-a="subDo"]'); else if (await page.$('.modal [data-a="subDecline"]')) await click('.modal [data-a="subDecline"]'); if (await page.$('.modal [data-a="subClose"]')) await click('.modal [data-a="subClose"]'); continue; }
    if (await page.evaluate(() => FM.UI.live && !FM.UI.live.run && !FM.UI.live.m.done)) { if (g < 3000 && await page.$('[data-a="talk"]')) { await shot('e4-live'); await click('[data-a="talk"][data-v="ruhig"]'); } await click('[data-a="livePause"]'); }
    await page.waitForTimeout(40);
  }
  await click('[data-a="toReport"]'); await toastErr('report'); await shot('e5-report');
  await page.evaluate(() => FM.UI.go('comp', { tier: 'CL' })); await toastErr('comp'); await shot('e6-cl-table');
  await click('.main .tabs [data-v="fixtures"]'); await toastErr('fixtures'); await shot('e7-cl-fixtures');
  await click('.main .tabs [data-v="ko"]'); await toastErr('ko');
  await page.selectOption('[data-c="compTier"]', 'EL'); await toastErr('EL'); await page.selectOption('[data-c="compTier"]', '1'); await toastErr('BL');
  await click('.main .tabs [data-v="mine"]'); await shot('e8-mine');
  await click('.nav [data-v="finance"]'); await toastErr('finance');
  await click('.nav [data-v="transfers"]'); await page.selectOption('[data-c="flt"][data-k="src"]', 'intl'); await toastErr('intl'); await shot('e9-transfers-intl');
  await click('tr[data-a="player"]'); await toastErr('player'); if (await page.$('[data-a="closeModal"]')) await click('[data-a="closeModal"]');
  // Rest der Saison automatisch, dann K.-o.-Ansicht und Saisonabschluss
  await page.evaluate(() => { const w = FM.UI.world; let g = 0; while (FM.Game.nextStep(w).kind !== 'seasonEnd' && g++ < 500) FM.Game.advanceAuto(w, true); FM.UI.go('comp', { tier: 'CL', tab: 'ko' }); });
  await toastErr('ko-end'); await shot('e10-cl-ko');
  await page.evaluate(() => FM.UI.go('office')); await shot('e11-office-end');
  await click('.top [data-a="next"]'); await toastErr('seasonend'); await shot('e12-seasonend');
  await click('[data-a="newSeason"]'); if (await page.$('[data-a="takeJob"]')) await click('[data-a="takeJob"]');
  await page.evaluate(() => FM.UI.go('club', { tab: 'history' })); await toastErr('history');
  // Speichern und Laden mit Europapokal
  const txt = await page.evaluate(() => { const t = FM.Save.serialize(FM.UI.world); const r = FM.Save.parse(t); return r.err || (r.world.euro && Object.keys(r.world.euro.comps).length === 3 ? 'ok ' + Math.round(t.length / 1024) + ' kB' : 'euro fehlt'); });
  if (!/^ok/.test(txt)) errors.push('Speichern/Laden: ' + txt);
  console.log('Spielstand:', txt);
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'OK: Europapokal-Oberfläche ohne Fehler');
  await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH', String(e).split('\n').slice(0, 4).join('\n')); process.exit(2); });
