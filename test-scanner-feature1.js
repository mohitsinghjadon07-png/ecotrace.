const fs = require('fs');
const path = require('path');

async function runFeature1Tests() {
  console.log('===============================================================');
  console.log('🌿 ECOTRACE FEATURE 1 TEST: AI WASTE SCANNER & HUMAN VERIFICATION');
  console.log('===============================================================\n');

  const base = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Reset confidence threshold to baseline 0.75 for test isolation
  await fetch(base + '/api/scanner/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confidenceThreshold: 0.75 })
  });

  // 1. Scanner Configuration API
  console.log('--- 1. Testing Scanner Configuration & Model Info ---');
  const configRes = await (await fetch(base + '/api/scanner/config')).json();
  assert(configRes.success === true, 'Scanner config endpoint returns success');
  assert(typeof configRes.config.confidenceThreshold === 'number', `Default confidence threshold is: ${configRes.config.confidenceThreshold}`);
  assert(typeof configRes.config.modelName === 'string', `Active vision model: ${configRes.config.modelName}`);

  // 2. Genuine Computer Vision: Clean Organic Waste Image
  console.log('\n--- 2. Testing Genuine Computer Vision (Clean Organic Image) ---');
  const fruitBuf = fs.readFileSync(path.join(__dirname, 'test-fixtures', 'organic_fruit.jpg'));
  const fruitB64 = 'data:image/jpeg;base64,' + fruitBuf.toString('base64');

  const fruitRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: fruitB64 })
  })).json();

  assert(fruitRes.success === true, 'Clean image scan completed successfully');
  const fResult = fruitRes.result;
  assert(fResult.category === 'Organic/Wet Waste', `Genuine CV predicted category: "${fResult.category}" (Expected Organic/Wet Waste)`);
  assert(fResult.confidence >= 0.70, `Genuine CV confidence score: ${fResult.confidencePercent} (>= 70%)`);
  assert(typeof fResult.detectedObject === 'string' && fResult.detectedObject.length > 0, `Detected object: "${fResult.detectedObject}"`);
  assert(typeof fResult.material === 'string', `Material classification: "${fResult.material}"`);
  assert(fResult.disposalMethod.includes('Compost'), `Recommended disposal route: "${fResult.disposalMethod}"`);
  assert(fResult.modelUsed.includes('Gemini') || fResult.modelUsed.includes('clip-vit'), `Actual vision model used: "${fResult.modelUsed}" (${fResult.inferenceTimeMs}ms)`);
  assert(fResult.reviewStatus === 'APPROVED', `Review status: "${fResult.reviewStatus}" (Auto-approved on high confidence)`);

  // 3. Genuine Computer Vision: Unsupported / Ambiguous Image
  console.log('\n--- 3. Testing Unsupported / Ambiguous Image Escalation ---');
  const tigerBuf = fs.readFileSync(path.join(__dirname, 'test-fixtures', 'unsupported_animal.jpg'));
  const tigerB64 = 'data:image/jpeg;base64,' + tigerBuf.toString('base64');

  const tigerRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: tigerB64 })
  })).json();

  assert(tigerRes.success === true, 'Unsupported image analyzed without crashing');
  const tResult = tigerRes.result;
  assert(tResult.category === 'Other/Unknown' || tResult.confidence < 0.75, `Correctly flagged unsupported item: Category "${tResult.category}", Confidence: ${tResult.confidencePercent}`);
  assert(tResult.reviewStatus === 'PENDING_REVIEW', `Status escalated to PENDING_REVIEW for human verification (${tResult.verificationStatus})`);

  // 4. Hazardous Material Escalation (E-Waste & Chemicals)
  console.log('\n--- 4. Testing Hazardous & Special Handling Escalation ---');
  const hazRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'preset:battery' })
  })).json();

  const hResult = hazRes.result;
  assert(hResult.category === 'E-Waste', `Identified special handling category: ${hResult.category}`);
  assert(hResult.reviewStatus === 'PENDING_REVIEW', `Hazardous/E-Waste automatically flagged PENDING_REVIEW: ${hResult.verificationStatus}`);
  assert(hResult.alertWarning !== null, `Safety warning generated: "${hResult.alertWarning}"`);

  // Check that real-time alert was generated
  const alertsRes = await (await fetch(base + '/api/alerts')).json();
  const hazAlert = alertsRes.alerts.find(a => a.description && (a.description.includes('E-Waste') || a.description.includes('Battery')));
  assert(hazAlert !== undefined, 'Live operational safety alert registered in database for hazardous scan');

  // 5. Configurable Confidence Threshold Escalation
  console.log('\n--- 5. Testing Configurable Confidence Thresholds ---');
  // Set strict threshold to 99% (so high-confidence 98% Gemini scan escalates)
  await fetch(base + '/api/scanner/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confidenceThreshold: 0.99 })
  });

  const strictRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: fruitB64 })
  })).json();

  assert(strictRes.result.reviewStatus === 'PENDING_REVIEW', `Scan escalated under strict 99% threshold (confidence ${strictRes.result.confidencePercent} < 99%)`);

  // Reset threshold back to 75%
  await fetch(base + '/api/scanner/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confidenceThreshold: 0.75 })
  });

  // 6. Operator Review: Approval Workflow
  console.log('\n--- 6. Testing Operator Review (Approval Workflow) ---');
  const approveScanId = tResult.id;
  const approveRes = await (await fetch(base + '/api/scanner/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scanId: approveScanId,
      action: 'APPROVE',
      reviewReason: 'Operator visually verified item as non-standard organic fiber',
      operatorId: 'Inspector Jane (ST-01)'
    })
  })).json();

  assert(approveRes.success === true, 'Operator review approval submitted');
  assert(approveRes.scan.reviewStatus === 'APPROVED', `Review status transitioned to: ${approveRes.scan.reviewStatus}`);
  assert(approveRes.scan.reviewedBy === 'Inspector Jane (ST-01)', `Audited reviewer persisted: ${approveRes.scan.reviewedBy}`);
  assert(typeof approveRes.scan.reviewedAt === 'string', `Review timestamp recorded: ${approveRes.scan.reviewedAt}`);

  // 7. Operator Review: Category Correction Workflow (Separate Persistence)
  console.log('\n--- 7. Testing Operator Review (Category Correction & Separate Persistence) ---');
  const correctScanId = fResult.id;
  const originalPredictedCat = fResult.category;
  const originalPredictedConf = fResult.confidence;

  const correctRes = await (await fetch(base + '/api/scanner/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scanId: correctScanId,
      action: 'CORRECT',
      correctedCategory: 'Metal',
      reviewReason: 'Operator identified as aluminium decorative replica fruit canister',
      operatorId: 'Supervisor Dave (ST-01)'
    })
  })).json();

  assert(correctRes.success === true, 'Operator correction submitted');
  const cScan = correctRes.scan;
  assert(cScan.reviewStatus === 'CORRECTED', `Review status transitioned to: ${cScan.reviewStatus}`);
  assert(cScan.category === 'Metal', `Corrected category updated to: ${cScan.category}`);
  assert(cScan.originalCategory === originalPredictedCat, `Original prediction separately persisted: "${cScan.originalCategory}"`);
  assert(cScan.originalConfidence === originalPredictedConf, `Original confidence separately persisted: ${cScan.originalConfidence}`);
  assert(cScan.correctedCategory === 'Metal', `Corrected category field persisted: "${cScan.correctedCategory}"`);
  assert(cScan.reviewReason === 'Operator identified as aluminium decorative replica fruit canister', `Audit reason persisted: "${cScan.reviewReason}"`);
  assert(cScan.disposalMethod.includes('Metal'), `Disposal route recomputed for corrected category: "${cScan.disposalMethod}"`);

  // 8. Human Verification Queue API
  console.log('\n--- 8. Testing Verification Queue API ---');
  const pendingRes = await (await fetch(base + '/api/scanner/pending-reviews')).json();
  assert(pendingRes.success === true, 'Pending reviews API call succeeded');
  assert(Array.isArray(pendingRes.scans), `Pending reviews returned: ${pendingRes.count} items awaiting verification`);

  // 9. Upload Validation & Error Handling (Requirement 8)
  console.log('\n--- 9. Testing Validation & Error Handling ---');
  // Test invalid mime type (PDF instead of image)
  const badMimeRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: 'data:application/pdf;base64,JVBERi0xLjQK' })
  })).json();
  assert(badMimeRes.success === false && badMimeRes.error.includes('Unsupported image format'), `Rejected non-image format: "${badMimeRes.error}"`);

  // Test missing payload
  const emptyRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })).json();
  assert(emptyRes.success === false, `Rejected empty payload: "${emptyRes.error}"`);

  // Test correction without reason
  const noReasonRes = await (await fetch(base + '/api/scanner/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanId: fResult.id, action: 'CORRECT', correctedCategory: 'Glass', reviewReason: '' })
  })).json();
  assert(noReasonRes.success === false && noReasonRes.error.includes('reviewReason'), `Enforced audit reason requirement on correction: "${noReasonRes.error}"`);

  // 10. Rules Engine & Sorting Station Integration (Requirement 9)
  console.log('\n--- 10. Testing Rules Engine & Sorting Station Integration ---');
  const loadRes = await (await fetch(base + '/api/session/load-scanned-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scannedItem: cScan,
      stationId: 'ST-01'
    })
  })).json();

  assert(loadRes.success === true, 'Loaded reviewed scan into sorting station tray');
  const loadedItem = loadRes.session.currentItem;
  assert(loadedItem.material === 'Metal', `Sorting station received corrected material: ${loadedItem.material}`);
  assert(loadedItem.route.includes('Metal'), `Rules engine routed corrected item to: "${loadedItem.route}"`);

  // 11. Final Summary
  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFeature1Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

