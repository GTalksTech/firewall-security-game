// Browser playthrough of the strategy edition, for a Playwright session:
// plays all three levels through the real interface, adding the reference
// gates as requests arrive, and returns each result screen plus any errors.
// Needs the game served at http://127.0.0.1:8000.
async (page) => {
  const errors = [];
  const external = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:8000') && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8000/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const plans = [[['E4', 'E6'], ['E3'], ['E5', 'E8']], [['X2', 'X6'], ['X4']], [['Y3', 'Y6'], ['Y5']]];
  const out = [];
  await page.getByRole('button', { name: /^Play/ }).click();
  for (let li = 0; li < 3; li += 1) {
    await page.getByRole('button', { name: 'Begin' }).click();
    let guard = 0;
    while (await page.locator('#screen').isHidden() && guard < 90) {
      guard += 1;
      if (await page.locator('#guide-next').count()) { await page.click('#guide-next'); continue; }
      if (await page.locator('#end-turn').isDisabled()) { await page.waitForTimeout(100); continue; }
      const nReq = (await page.locator('#requests li').count()) - 1;
      const want = plans[li].slice(0, nReq).flat();
      let left = Number((await page.locator('#actions strong').textContent()).trim()[0]);
      for (const id of want) {
        if (left <= 0) break;
        if (await page.locator(`#spare [data-rule="${id}"]`).count()) { await page.click(`#spare [data-rule="${id}"]`); left -= 1; }
      }
      while (left > 0 && await page.locator('#wall .chip.off').count()) { await page.locator('#wall .chip.off').first().click(); left -= 1; }
      await page.click('#end-turn');
      await page.waitForTimeout(150);
    }
    await page.waitForSelector('#screen:not([hidden])', { timeout: 10000 });
    out.push(await page.evaluate(() => document.querySelector('#screen-card').innerText.replace(/\n+/g, ' | ').slice(0, 90)));
    if (li < 2) await page.getByRole('button', { name: 'Next level' }).click();
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return { out, errors, external };
}
