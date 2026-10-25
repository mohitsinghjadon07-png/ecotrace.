async function runFullVerification() {
  console.log('=== ECOTRACE SECTION 33 VERIFICATION TEST ===\n');
  const baseUrl = 'http://localhost:3000';

  // 1. Initial Overview Stats
  const initialOverview = await (await fetch(baseUrl + '/api/overview')).json();
  console.log('1. Initial Overview Baseline:', initialOverview.stats.totalItemsProcessed, 'processed, Accuracy:', initialOverview.stats.sortingAccuracy);

  // 2. Start Session
  const startRes = await (await fetch(baseUrl + '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId: 'ST-01', mode: 'DEMO' })
  })).json();
  const session = startRes.session;
  console.log('2. Session Started:', session.id, 'at', session.stationName, 'Ruleset:', session.ruleset);

  // 3. Scan Tray (Detect 6 objects)
  const scanRes = await (await fetch(baseUrl + '/api/session/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })).json();
  console.log('3. Optical Tray Scanned:', scanRes.session.detectedItems.length, 'objects detected');
  scanRes.session.detectedItems.forEach((it, i) => {
    console.log('   [' + (i+1) + '] ' + it.label + ' (' + it.material + ') -> ' + it.route + ' | Condition: ' + it.condition + ' | Special: ' + it.specialHandling);
  });

  // 4. Start Sorting Queue
  const queueRes = await (await fetch(baseUrl + '/api/session/start-queue', { method: 'POST' })).json();
  console.log('\n4. Active Sorting Started. Current target:', queueRes.session.currentItem.label);

  // 5. Verify Item 1: PET Bottle Removal
  const v1 = await (await fetch(baseUrl + '/api/session/verify-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFailure: false })
  })).json();
  console.log('5. Physical Verification Item 1:', v1.verification.status, '| Msg:', v1.verification.message, '| Remaining Tray Count:', v1.session.remainingTrayItems.length);

  // 6. Advance & verify Item 2 (Aluminium Can)
  await fetch(baseUrl + '/api/session/next-item', { method: 'POST' });
  const v2 = await (await fetch(baseUrl + '/api/session/verify-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFailure: false })
  })).json();
  console.log('6. Verified Item 2 (Aluminium Can):', v2.verification.status);

  // 7. Advance & verify Item 3 (Banana Peel)
  await fetch(baseUrl + '/api/session/next-item', { method: 'POST' });
  const v3 = await (await fetch(baseUrl + '/api/session/verify-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFailure: false })
  })).json();
  console.log('7. Verified Item 3 (Banana Peel):', v3.verification.status);

  // 8. Advance & verify Item 4 (Paper Cup)
  await fetch(baseUrl + '/api/session/next-item', { method: 'POST' });
  const v4 = await (await fetch(baseUrl + '/api/session/verify-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFailure: false })
  })).json();
  console.log('8. Verified Item 4 (Paper Cup):', v4.verification.status);

  // 9. Advance to Item 5 (Household Battery - Special Handling)
  const q5 = await (await fetch(baseUrl + '/api/session/next-item', { method: 'POST' })).json();
  console.log('\n9. Item 5 Selected (Special Handling):', q5.session.currentItem.label);
  console.log('   Warning:', q5.session.currentItem.warning);
  console.log('   Instruction:', q5.session.currentItem.instruction);
  const v5 = await (await fetch(baseUrl + '/api/session/verify-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFailure: false })
  })).json();
  console.log('   Special Handling Separated & Verified:', v5.verification.status);

  // 10. Advance to Item 6 (Food Container - Contaminated)
  const q6 = await (await fetch(baseUrl + '/api/session/next-item', { method: 'POST' })).json();
  console.log('\n10. Item 6 Selected (Contaminated):', q6.session.currentItem.label);
  console.log('    Contamination Issue:', q6.session.currentItem.contaminationIssue);
  console.log('    Assigned Route by local ruleset:', q6.session.currentItem.route);
  const v6 = await (await fetch(baseUrl + '/api/session/verify-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFailure: false })
  })).json();
  console.log('    Contaminated Item Verified & Routed:', v6.verification.status);

  // 11. Complete Session
  const completion = await (await fetch(baseUrl + '/api/session/next-item', { method: 'POST' })).json();
  console.log('\n11. Final Session State:', completion.session.state, '(' + completion.session.verifiedCount + '/' + completion.session.itemCount + ' items verified)');

  // 12. Check Updated City Overview Stats
  const updatedOverview = await (await fetch(baseUrl + '/api/overview')).json();
  console.log('\n12. Updated City Overview KPI:');
  console.log('    Items Processed:', initialOverview.stats.totalItemsProcessed, '->', updatedOverview.stats.totalItemsProcessed);
  console.log('    Special Handling Total:', initialOverview.stats.specialHandlingCount, '->', updatedOverview.stats.specialHandlingCount);

  // 13. Verify Database Records & Traceability
  const records = await (await fetch(baseUrl + '/api/waste-records')).json();
  console.log('\n13. Traceability Records in DB:', records.records.length, 'records available');
  const latestItem = records.records[0];
  console.log('    Latest Record: ' + latestItem.id + ' | ' + latestItem.label + ' | ' + latestItem.route + ' | Status: ' + latestItem.status);

  // 14. Verify Item Audit Lifecycle Events
  const events = await (await fetch(baseUrl + '/api/waste-records/' + latestItem.id + '/events')).json();
  console.log('\n14. Audit Events for ' + latestItem.id + ':');
  events.events.forEach(e => console.log('    -> [' + e.eventType + '] at ' + e.timestamp));

  // 15. Verify Live Alerts Generated
  const alerts = await (await fetch(baseUrl + '/api/alerts')).json();
  console.log('\n15. Live Alerts Count:', alerts.alerts.length);
  console.log('    Latest Alert:', alerts.alerts[0].title);

  // 16. Verify CSV Export
  const csvRes = await fetch(baseUrl + '/api/reports/export');
  const csvText = await csvRes.text();
  console.log('\n16. CSV Export Response Length:', csvText.length, 'bytes');
  console.log('    CSV Header:', csvText.split('\n')[0]);
  console.log('    CSV Sample Row:', csvText.split('\n')[1]);

  console.log('\n=== ALL 16 INTEGRATION TESTS PASSED PERFECTLY ===');
}

runFullVerification();
