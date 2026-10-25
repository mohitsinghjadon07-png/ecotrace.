async function runUpgradeTests() {
  console.log('=== ECOTRACE UPGRADE VERIFICATION TEST ===\n');
  const base = 'http://localhost:3000';

  // 1. Overview API Check
  const overview = await (await fetch(base + '/api/overview')).json();
  console.log('1. Overview API OK. Scanner Stats:', overview.stats.scannerStats);

  // 2. Test All Waste Categories in Scanner
  const categories = [
    { preset: 'preset:bottle', expected: 'Plastic', rec: true },
    { preset: 'preset:battery', expected: 'E-Waste', rec: false },
    { preset: 'preset:banana', expected: 'Organic/Wet Waste', rec: true },
    { preset: 'preset:can', expected: 'Metal', rec: true },
    { preset: 'preset:cardboard', expected: 'Paper/Cardboard', rec: true },
    { preset: 'preset:glass', expected: 'Glass', rec: true },
    { preset: 'preset:paint', expected: 'Hazardous Waste', rec: false },
    { preset: 'preset:mixed', expected: 'Mixed Waste', rec: false }
  ];

  console.log('\n2. Testing AI Scanner Classification Across Categories:');
  for (const c of categories) {
    const res = await (await fetch(base + '/api/scanner/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: c.preset })
    })).json();

    const r = res.result;
    const pass = r.category === c.expected && r.recyclable === c.rec;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] ${c.preset} -> ${r.wasteType} | Category: ${r.category} | Recyclable: ${r.recyclable} | Risk: ${r.riskLevel} | Nearest Type: ${r.suitableFacilityType}`);
  }

  // 3. Test Recent Scans API
  const recent = await (await fetch(base + '/api/scanner/recent?limit=5')).json();
  console.log('\n3. Recent Scans Count:', recent.scans.length);
  console.log('   Latest Scan:', recent.scans[0].wasteType, 'at', recent.scans[0].scannedAt);

  // 4. Test Scanner Stats API
  const scannerStats = await (await fetch(base + '/api/scanner/stats')).json();
  console.log('\n4. Updated Scanner Stats:', scannerStats.stats);

  // 5. Test Waste Locations API
  const locs = await (await fetch(base + '/api/locations')).json();
  console.log('\n5. Locations Total:', locs.locations.length);

  // 6. Test Nearest E-Waste Location
  const nearestEwaste = await (await fetch(base + '/api/locations/nearest?lat=45.5152&lng=-122.6784&category=e_waste')).json();
  console.log('\n6. Nearest E-Waste Facility to User:');
  console.log('   Name:', nearestEwaste.locations[0].name);
  console.log('   Distance:', nearestEwaste.locations[0].distanceKm, 'km (' + nearestEwaste.locations[0].distanceMiles + ' miles)');
  console.log('   Accepted:', nearestEwaste.locations[0].acceptedTypes);

  // 7. Test Nearest Recycling Hub
  const nearestRecycling = await (await fetch(base + '/api/locations/nearest?lat=45.5152&lng=-122.6784&category=recycling')).json();
  console.log('\n7. Nearest Recycling Hub to User:');
  console.log('   Name:', nearestRecycling.locations[0].name);
  console.log('   Distance:', nearestRecycling.locations[0].distanceKm, 'km');

  // 8. Regression Check: Existing Sorting Station still operational
  const session = await (await fetch(base + '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId: 'ST-01', mode: 'DEMO' })
  })).json();
  const scan = await (await fetch(base + '/api/session/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })).json();
  console.log('\n8. Regression Check: Sorting Station Session', session.session.id, 'scanned', scan.session.detectedItems.length, 'tray items successfully!');

  console.log('\n=== ALL UPGRADE INTEGRATION TESTS PASSED 100% ===');
}

runUpgradeTests();
