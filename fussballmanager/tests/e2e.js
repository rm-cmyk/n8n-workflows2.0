/* Durchspieltest im echten Browser: neues Spiel, alle Bildschirme, Live-Spiel, Speichern/Laden, mehrere Wochen */
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = process.env.SHOTS || '';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const click = async (sel) => { await page.click(sel, { timeout: 5000 }); };
  const toastErr = async (where) => { const t = await page.textContent('#toast'); if (/schiefgegangen/.test(t || '')) errors.push(where + ': ' + t); };
  const closeModals = async () => { for (let i = 0; i < 5; i++) { if (await page.$('.modal [data-a="eventPick"]')) await click('.modal [data-a="eventPick"]'); else if (await page.$('.modal [data-a="closeModal"]')) await click('.modal [data-a="closeModal"]'); else break; } };
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await shot('01-start');
  await click('[data-a="go"][data-v="new"]');
  await page.fill('#mgr-name', 'Petra Probe');
  await click('[data-a="tab"][data-v="2"]');
  await click('[data-a="pickClub"][data-v="FCK"]');
  await shot('02-new');
  await click('[data-a="startGame"]');
  await page.waitForSelector('.shell');
  await shot('03-office');
  for (const v of ['squad', 'lineup', 'training', 'transfers', 'finance', 'club', 'comp', 'inbox', 'system']) {
    await click('.nav [data-v="' + v + '"]'); await toastErr(v); await shot('04-' + v);
    const tabs = await page.$$eval('.main .tabs [data-a="tab"]', (els) => els.map((e) => e.dataset.v));
    for (const t of tabs) { await click('.main .tabs [data-v="' + t + '"]'); await toastErr(v + '/' + t); if (SHOTS && (v === 'comp' || v === 'club')) await shot('04-' + v + '-' + t); }
  }
  // Sponsor wählen
  await click('.nav [data-v="office"]');
  if (await page.$('[data-a="sponsorPick"]')) { await click('[data-a="sponsorPick"]'); await shot('05-sponsor'); await click('[data-a="sponsorSign"][data-i="1"]'); }
  // Spieler-Dialog + Vertragsverlängerung
  await click('.nav [data-v="squad"]'); await click('tr[data-a="player"]'); await shot('06-player');
  await click('[data-a="negStage"][data-v="renew"]'); await click('[data-a="renewDo"]'); await toastErr('renew'); await click('[data-a="closeModal"]');
  // Aufstellung: Formation wechseln, Spieler tauschen, beste Elf
  await click('.nav [data-v="lineup"]'); await page.selectOption('[data-c="formation"]', '4-2-3-1');
  await click('.slot[data-i="9"]'); await click('.bslot[data-i="2"]'); await toastErr('swap'); await click('[data-a="autoXI"]');
  // Transfers: vereinslosen/Auslands-Spieler suchen und bieten
  await click('.nav [data-v="transfers"]'); await page.selectOption('[data-c="flt"][data-k="src"]', 'abroad'); await click('tr[data-a="player"]');
  if (await page.$('[data-a="bidDo"]')) { await click('[data-a="bidDo"]'); await shot('07-bid'); if (await page.$('[data-a="signDo"]')) { await click('[data-a="signDo"]'); await toastErr('sign'); } }
  if (await page.$('[data-a="closeModal"]')) await click('[data-a="closeModal"]');
  // Trainingslager
  await click('.nav [data-v="training"]'); if (await page.$('[data-a="camp"][data-i="2"]')) await click('[data-a="camp"][data-i="2"]');
  // Wochen durchspielen, erstes Pflichtspiel live
  let liveDone = 0, guard = 0, weeks = +(process.env.WEEKS || 9);
  const week = async () => page.evaluate(() => FM.UI.world.week + (FM.UI.world.season - 2026) * 100);
  const target = (await week()) + weeks;
  while ((await week()) < target && guard++ < 400) {
    if (await page.$('.modal [data-a="eventPick"]')) { await click('.modal [data-a="eventPick"]'); await click('.modal [data-a="closeModal"]'); continue; }
    if (await page.$('.modal [data-a="closeModal"]')) { await click('.modal [data-a="closeModal"]'); continue; }
    const view = await page.evaluate(() => FM.UI.view);
    if (view === 'prematch') {
      if (await page.$('[data-a="fixLineup"]')) await click('[data-a="fixLineup"]');
      if (liveDone < 2) {
        await click('[data-a="kickoff"]'); await page.waitForSelector('.ticker'); await click('[data-a="liveSpeed"][data-v="3"]');
        let g2 = 0; let subbed = false;
        while (g2++ < 4000) {
          if (await page.$('[data-a="toReport"]')) break;
          if (await page.$('.modal')) { if (await page.$('.modal [data-a="subDo"]')) await click('.modal [data-a="subDo"]'); else if (await page.$('.modal [data-a="subDecline"]')) await click('.modal [data-a="subDecline"]'); if (await page.$('.modal [data-a="subClose"]')) await click('.modal [data-a="subClose"]'); else if (await page.$('.modal [data-a="closeModal"]')) await click('.modal [data-a="closeModal"]'); continue; }
          if (await page.$('[data-a="talk"]')) { await shot('08-halftime'); await click('[data-a="talk"][data-v="lob"]'); }
          const paused = await page.evaluate(() => FM.UI.live && !FM.UI.live.run && !FM.UI.live.m.done);
          if (paused) {
            if (!subbed) { subbed = true; await click('[data-a="liveSubs"]'); await shot('09-subs'); await click('[data-a="subDo"]'); await page.selectOption('[data-c="liveTactic"][data-k="stance"]', '1'); await page.selectOption('[data-c="liveFormation"]', '4-4-2'); await click('[data-a="swapDo"]'); await click('[data-a="subClose"]'); }
            await click('[data-a="livePause"]');
          }
          await page.waitForTimeout(40);
        }
        await shot('10-live-end'); await click('[data-a="toReport"]'); await shot('11-report'); liveDone++;
      } else await click('[data-a="instant"]');
      await toastErr('match'); continue;
    }
    if (view === 'sacked') { await click('[data-a="takeJob"]'); continue; }
    if (view === 'seasonend') { await shot('12-seasonend'); await click('[data-a="newSeason"]'); continue; }
    await click('.top [data-a="next"]'); await toastErr('next');
  }
  for (let i = 0; i < 4; i++) { if (await page.$('.modal [data-a="eventPick"]')) await click('.modal [data-a="eventPick"]'); if (await page.$('.modal [data-a="closeModal"]')) await click('.modal [data-a="closeModal"]'); }
  if ((await page.evaluate(() => FM.UI.view)) === 'seasonend') await click('[data-a="newSeason"]');
  if ((await page.evaluate(() => FM.UI.view)) === 'sacked') await click('[data-a="takeJob"]');
  await click('.nav [data-v="office"]'); await shot('13-office-later');
  await click('.nav [data-v="comp"]'); await shot('14-table');
  // Speichern, neu laden, weiterspielen
  await click('.nav [data-v="system"]'); await click('[data-a="saveSlot"][data-s="1"]');
  const before = await page.evaluate(() => JSON.stringify([FM.UI.world.week, FM.UI.world.clubs[FM.UI.world.user].money, Object.keys(FM.UI.world.players).length]));
  await page.reload(); await click('[data-a="loadSlot"][data-s="1"]'); await page.waitForSelector('.shell');
  const after = await page.evaluate(() => JSON.stringify([FM.UI.world.week, FM.UI.world.clubs[FM.UI.world.user].money, Object.keys(FM.UI.world.players).length]));
  if (before !== after) errors.push('Spielstand nach Neuladen verändert: ' + before + ' vs ' + after);
  await click('.top [data-a="next"]');
  // Handy-Breite
  await closeModals();
  if ((await page.evaluate(() => FM.UI.view)) === 'prematch') await click('[data-a="instant"]');
  await closeModals();
  await page.setViewportSize({ width: 390, height: 800 }); await click('.nav [data-v="office"]'); await shot('15-mobile');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push('Seite scrollt auf dem Handy seitwärts');
  console.log('Woche', await week(), '· Live-Spiele', liveDone, '· Schleifen', guard);
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'OK: keine Fehler in der Oberfläche');
  await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });
