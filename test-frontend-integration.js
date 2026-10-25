const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runFrontendIntegrationTests() {
  console.log('===============================================================');
  console.log('🌐 ECOTRACE NEW FRONTEND INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

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

  try {
    // 1. Verify Root HTML
    console.log('--- 1. Testing Static Assets & HTML ---');
    const rootRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    assert(rootRes.status === 200, `Root route returns HTTP 200 (Got ${rootRes.status})`);
    assert(rootRes.raw.includes('EcoTrace'), 'HTML contains EcoTrace branding');
    assert(rootRes.raw.includes('EcoTrace AI Assistant'), 'HTML contains AI Assistant section');
    assert(rootRes.raw.includes('QR Traceability'), 'HTML contains QR Traceability section');
    assert(rootRes.raw.includes('Sorting Station'), 'HTML contains Sorting Station section');

    // 2. Overview & Live Impact
    console.log('\n--- 2. Testing Overview & Live Impact APIs ---');
    const overviewRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/overview',
      method: 'GET'
    });
    assert(overviewRes.status === 200 && overviewRes.body.success, 'GET /api/overview returns success');
    assert(typeof overviewRes.body.stats === 'object', 'Overview returns stats object');

    const impactRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/impact',
      method: 'GET'
    });
    assert(impactRes.status === 200 && impactRes.body.success, 'GET /api/impact returns success');
    assert(typeof impactRes.body.divertedKg === 'number', 'Impact returns numeric divertedKg');
    assert(typeof impactRes.body.recyclingRate === 'number', 'Impact returns numeric recyclingRate');

    // 3. Centers & Activity
    console.log('\n--- 3. Testing Centers & Activity APIs ---');
    const centersRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/centers',
      method: 'GET'
    });
    assert(centersRes.status === 200 && Array.isArray(centersRes.body.data), 'GET /api/centers returns data array');
    assert(centersRes.body.data.length > 0, `Returned ${centersRes.body.data.length} recycling centers`);
    assert(centersRes.body.data[0].lat && centersRes.body.data[0].lng, 'Centers have lat/lng coordinates for Leaflet map');

    const activityRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/activity',
      method: 'GET'
    });
    assert(activityRes.status === 200 && Array.isArray(activityRes.body.data), 'GET /api/activity returns scan activity array');

    // 4. Batch Traceability End-to-End
    console.log('\n--- 4. Testing Batch Traceability & SHA-256 Chain ---');
    const batchesRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/batches',
      method: 'GET'
    });
    assert(batchesRes.status === 200 && batchesRes.body.success, 'GET /api/batches returns success');

    // Create a new batch
    const testBatchPayload = {
      material: 'Rigid Plastics (PET / HDPE)',
      weightKg: 420.5,
      facility: 'EcoTrace Materials Recovery Facility',
      operator: 'Automated Test Operator',
      contaminationRate: 2.1
    };
    const createBatchRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/batches',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testBatchPayload);

    assert(createBatchRes.status === 201 && createBatchRes.body.success, 'POST /api/batches successfully registers batch');
    const createdBatch = createBatchRes.body.data;
    assert(createdBatch && createdBatch.batch_id, `Created batch ID: ${createdBatch?.batch_id}`);
    assert(createdBatch?.qr_code && createdBatch.qr_code.startsWith('data:image/png;base64,'), 'Batch includes generated QR code image');

    // Append lifecycle event
    const eventPayload = {
      status: 'COLLECTED',
      facility: 'EcoTrace Materials Recovery Facility',
      operator: 'Collection Specialist C-04',
      notes: 'Picked up from industrial generation site.'
    };
    const addEventRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/batches/${createdBatch.batch_id}/events`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, eventPayload);
    assert(addEventRes.status === 201 && addEventRes.body.success, 'POST /api/batches/:id/events logs COLLECTED stage');

    // Verify Hash Chain
    const verifyRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/batches/${createdBatch.batch_id}/verify`,
      method: 'GET'
    });
    assert(verifyRes.status === 200 && verifyRes.body.valid === true, 'GET /api/batches/:id/verify confirms cryptographic chain integrity');
    assert(verifyRes.body.chainLength >= 2, `Chain length verified with ${verifyRes.body.chainLength} links`);

    // 5. Scan Endpoint Normalization
    console.log('\n--- 5. Testing Scan Endpoint Normalization ---');
    const sampleImgBuf = fs.readFileSync(path.join(__dirname, 'test-fixtures', 'organic_fruit.jpg'));
    const sampleImgB64 = 'data:image/jpeg;base64,' + sampleImgBuf.toString('base64');
    const scanRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/scan',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      imageBase64: sampleImgB64
    });

    assert(scanRes.status === 200 && scanRes.body.success, 'POST /api/scan responds with success');
    assert(typeof scanRes.body.name === 'string', `Returns normalized waste name: "${scanRes.body.name}"`);
    assert(typeof scanRes.body.category === 'string', `Returns normalized category: "${scanRes.body.category}"`);
    assert(typeof scanRes.body.confidencePercent === 'number' || typeof scanRes.body.confidencePercent === 'string', `Returns confidencePercent: ${scanRes.body.confidencePercent}`);
    assert(typeof scanRes.body.recyclable === 'boolean', `Returns boolean recyclable flag: ${scanRes.body.recyclable}`);
    assert(Array.isArray(scanRes.body.instructions) || typeof scanRes.body.instructions === 'string', 'Returns disposal instructions');

    // 6. Security & Key Non-Exposure Check
    console.log('\n--- 6. Verifying API Key Security ---');
    const clientJsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/app.js',
      method: 'GET'
    });
    assert(!clientJsRes.raw.includes('AIzaSy'), 'Client app.js contains NO hardcoded Gemini API keys');

    const clientHtmlRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/index.html',
      method: 'GET'
    });
    assert(!clientHtmlRes.raw.includes('AIzaSy'), 'Client index.html contains NO hardcoded Gemini API keys');

    const configJsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/config.js',
      method: 'GET'
    });
    assert(!configJsRes.raw.includes('AIzaSy'), 'Client config.js contains NO hardcoded Gemini API keys');

    const assistantConfigRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/assistant/config',
      method: 'GET'
    });
    assert(assistantConfigRes.status === 200 && assistantConfigRes.body.configured === true, 'GET /api/assistant/config reports configured: true');
    assert(assistantConfigRes.body.key === undefined && assistantConfigRes.body.apiKey === undefined, 'Config endpoint NEVER exposes API key value');

    console.log('\n===============================================================');
    console.log(`INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during integration test:', err);
    process.exit(1);
  }
}

runFrontendIntegrationTests();
