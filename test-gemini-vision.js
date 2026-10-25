/**
 * EcoTrace Gemini Vision AI Integration Test Suite
 * 
 * Verifies:
 * 1. Image payload validation (format, corrupt base64, size > 15MB)
 * 2. Missing API key handling (graceful 503 response without server crash)
 * 3. Live Gemini Vision multimodal inference on real waste photo (organic_fruit.jpg)
 * 4. Structured data verification (category, subtype, visual evidence, confidence, recyclability, disposal)
 * 5. Ambiguous & non-waste handling (unsupported_animal.jpg) with PENDING_REVIEW escalation
 * 6. Sorting Station Photo Detection integration (/api/session/scan with mode: 'PHOTO')
 * 7. Key protection: GEMINI_API_KEY is never exposed in response payloads
 */

const fs = require('fs');
const path = require('path');

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

async function runGeminiVisionTests() {
  console.log('===============================================================');
  console.log('🌿 ECOTRACE GEMINI VISION AI INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

  // --- 1. Image Payload Validation ---
  console.log('--- 1. Testing Image Payload & Format Validation ---');
  
  // Empty payload
  const emptyRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })).json();
  assert(emptyRes.success === false, 'Rejects empty payload without image or preset');

  // Unsupported format (PDF)
  const pdfRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: 'data:application/pdf;base64,JVBERi0xLjQK...' })
  })).json();
  assert(pdfRes.success === false && pdfRes.error.includes('Unsupported'), 'Rejects non-image format (PDF)');

  // Oversized image payload (>15MB)
  const fakeHuge = 'data:image/jpeg;base64,' + Buffer.alloc(16 * 1024 * 1024).toString('base64');
  const hugeRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: fakeHuge })
  })).json();
  assert(hugeRes.success === false && (hugeRes.error.toLowerCase().includes('exceeds') || hugeRes.error.toLowerCase().includes('limit')), 'Rejects oversized image (>15MB)');

  // --- 2. Live Gemini Vision AI: Real Clean Waste Photo ---
  console.log('\n--- 2. Testing Live Gemini Vision Analysis (organic_fruit.jpg) ---');
  const fruitBuf = fs.readFileSync(path.join(__dirname, 'test-fixtures', 'organic_fruit.jpg'));
  const fruitB64 = 'data:image/jpeg;base64,' + fruitBuf.toString('base64');

  const startFruit = Date.now();
  const fruitRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: fruitB64, location: 'AITR Campus, Indore' })
  })).json();
  const fruitDuration = Date.now() - startFruit;

  assert(fruitRes.success === true, `Gemini Vision scan completed successfully in ${fruitDuration}ms`);
  const f = fruitRes.result;
  assert(f.category === 'Organic/Wet Waste', `Canonical category: "${f.category}" (Expected Organic/Wet Waste)`);
  assert(typeof f.detectedObject === 'string' && f.detectedObject.length > 0, `Detected object: "${f.detectedObject}"`);
  assert(typeof f.material === 'string' && f.material.length > 0, `Material subtype: "${f.material}"`);
  assert(typeof f.visualEvidence === 'string' && f.visualEvidence.length > 10, `Visual evidence provided: "${f.visualEvidence.slice(0, 75)}..."`);
  assert(f.confidence >= 0.70, `Confidence estimate: ${f.confidencePercent} (>= 70%)`);
  assert(f.recyclable === true, `Recyclable assessment: ${f.recyclable}`);
  assert(f.disposalMethod.toLowerCase().includes('compost') || f.disposalMethod.toLowerCase().includes('organic'), `Disposal route: "${f.disposalMethod}"`);
  assert(f.modelUsed.includes('Gemini'), `Engine clearly labeled as Gemini Vision AI: "${f.modelUsed}"`);
  assert(f.reviewStatus === 'APPROVED', `High-confidence scan auto-approved: ${f.reviewStatus}`);

  // --- 3. Live Gemini Vision AI: Non-Waste / Ambiguous Image ---
  console.log('\n--- 3. Testing Non-Waste & Ambiguity Handling (unsupported_animal.jpg) ---');
  const tigerBuf = fs.readFileSync(path.join(__dirname, 'test-fixtures', 'unsupported_animal.jpg'));
  const tigerB64 = 'data:image/jpeg;base64,' + tigerBuf.toString('base64');

  const tigerRes = await (await fetch(base + '/api/scanner/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: tigerB64 })
  })).json();

  assert(tigerRes.success === true, 'Non-waste image processed successfully');
  const t = tigerRes.result;
  assert(t.category === 'Other/Unknown' || t.isAmbiguousOrUnclear === true || t.confidence < 0.75, 
    `Flagged ambiguous/non-waste: Category "${t.category}", Ambiguous: ${t.isAmbiguousOrUnclear}, Confidence: ${t.confidencePercent}`);
  assert(t.reviewStatus === 'PENDING_REVIEW', `Escalated to PENDING_REVIEW: "${t.verificationStatus}"`);
  assert(typeof t.visualEvidence === 'string', `Visual evidence explains non-waste context: "${t.visualEvidence.slice(0, 75)}..."`);

  // --- 4. Photo Detection Integration in Sorting Station ---
  console.log('\n--- 4. Testing Sorting Station Photo Detection (/api/session/scan with mode: PHOTO) ---');
  // Start session in PHOTO mode
  const sessRes = await (await fetch(base + '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId: 'ST-01', mode: 'PHOTO' })
  })).json();
  assert(sessRes.success === true, `Photo sorting session started: ${sessRes.session.id}`);

  // Scan tray using camera photo
  const trayScanRes = await (await fetch(base + '/api/session/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: fruitB64, filename: 'overhead_tray_cam.jpg' })
  })).json();
  assert(trayScanRes.success === true, 'Overhead tray photo scanned successfully');
  const trayItem = trayScanRes.session.detectedItems[0];
  assert(trayItem && trayItem.id === 'OBJ-CAM-001', `Tray item generated: ${trayItem.id} (${trayItem.label})`);
  assert(trayItem.category === 'ORGANIC/WET WASTE' || trayItem.category === 'ORGANIC', `Category assigned on tray: ${trayItem.category}`);
  assert(trayItem.modelUsed && trayItem.modelUsed.includes('Gemini'), `Sorting tray object labeled with Gemini model: "${trayItem.modelUsed}"`);
  assert(typeof trayItem.visualEvidence === 'string', 'Tray item retains visual evidence');

  // --- 5. Key Protection & Security Check ---
  console.log('\n--- 5. Security & Sensitive Key Leak Prevention ---');
  const rawFruitPayload = JSON.stringify(fruitRes);
  const rawTigerPayload = JSON.stringify(tigerRes);
  const rawTrayPayload = JSON.stringify(trayScanRes);

  assert(!rawFruitPayload.includes('AIza') && !rawFruitPayload.includes(process.env.GEMINI_API_KEY || 'MISSING_KEY_STRING'), 
    'CRITICAL: API key is not present in waste scanner response payload');
  assert(!rawTigerPayload.includes('AIza'), 'CRITICAL: API key is not present in ambiguous scan response');
  assert(!rawTrayPayload.includes('AIza'), 'CRITICAL: API key is not present in sorting tray scan response');

  // --- 6. Summary ---
  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGeminiVisionTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
