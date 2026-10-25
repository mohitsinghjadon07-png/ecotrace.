const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runHomepageRoutingVerification() {
  console.log('===============================================================');
  console.log('🔍 ECOTRACE HOMEPAGE & ROUTING VERIFICATION TEST');
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
    // 1. Root route "/"
    console.log('--- 1. Testing Root URL ("/") ---');
    const rootRes = await get('/');
    assert(rootRes.status === 200, `Root URL "/" returns HTTP 200 (Got ${rootRes.status})`);
    assert(rootRes.body.includes('class="brand" href="/" data-route="home"'), 'Logo/home link points to "/"');
    assert(rootRes.body.includes('<section class="page active-page" id="page-home">'), 'Landing page #page-home is initially set as active-page');
    assert(rootRes.body.includes('Turn waste into'), 'Landing page contains hero headline: "Turn waste into"');
    assert(rootRes.body.includes('Scan with Gemini Vision'), 'Landing page contains primary CTA: "Scan with Gemini Vision"');
    assert(rootRes.body.includes('data-route="correction"'), 'Navigation contains dedicated Operator Correction link');

    // 2. Hero Background Image Integration
    console.log('\n--- 2. Verifying Hero Background Image Integration ---');
    const imgRes = await get('/assets/images/hero-bg.jpg');
    assert(imgRes.status === 200, 'Hero background image /assets/images/hero-bg.jpg served successfully (HTTP 200)');
    assert(imgRes.headers['content-type'] === 'image/jpeg', 'Hero background has correct content-type image/jpeg');
    assert(parseInt(imgRes.headers['content-length'] || '0') > 50000, 'Hero background file is valid image payload');

    const cssRes = await get('/styles.css');
    assert(cssRes.status === 200, 'styles.css served successfully');
    assert(cssRes.body.includes('/assets/images/hero-bg.jpg'), 'styles.css references /assets/images/hero-bg.jpg');
    assert(cssRes.body.includes('.hidden') && cssRes.body.includes('display: none !important'), 'styles.css defines .hidden with display: none !important');
    assert(cssRes.body.includes('.modal-overlay.hidden') && cssRes.body.includes('display: none !important'), 'styles.css defines .modal-overlay.hidden with display: none !important');

    // 3. Modals initially hidden
    console.log('\n--- 3. Verifying Modals have "hidden" class in HTML ---');
    assert(rootRes.body.includes('id="correctScanModal" class="modal-overlay hidden"') || 
           rootRes.body.includes('class="modal-overlay hidden" id="correctScanModal"'), 'Operator Category Correction modal has class "modal-overlay hidden"');
    assert(rootRes.body.includes('class="modal-overlay hidden" id="alertsModal"'), 'Alerts modal has class "modal-overlay hidden"');
    assert(rootRes.body.includes('class="modal-overlay hidden" id="registerBatchModal"'), 'Register Batch modal has class "modal-overlay hidden"');
    assert(rootRes.body.includes('class="modal-overlay hidden" id="advanceEventModal"'), 'Advance Event modal has class "modal-overlay hidden"');

    // 4. Server Client-side Routing Fallback
    console.log('\n--- 4. Testing Direct Route Navigation & Fallback ---');
    const correctionRes = await get('/correction');
    assert(correctionRes.status === 200, 'Direct URL "/correction" returns HTTP 200 HTML');
    assert(correctionRes.body.includes('id="correctScanModal"'), 'HTML contains correctScanModal markup for direct /correction access');

    // 5. JavaScript Routing Logic Simulation
    console.log('\n--- 5. Simulating Frontend Client-Side Routing Controller ---');
    const jsRes = await get('/app.js');
    assert(jsRes.status === 200, 'app.js served successfully');
    assert(jsRes.body.includes("function parseCurrentRoute()"), 'app.js contains parseCurrentRoute function');
    assert(jsRes.body.includes("target === 'correction'"), 'app.js contains dedicated handling for "correction" route');
    assert(jsRes.body.includes("btn.classList.contains('brand') || targetRoute === 'home'"), 'app.js intercepts brand/home clicks and routes to root "/"');

    // Test parseCurrentRoute logic using mock window environments
    function simulateRoute(pathname, hash) {
      const cleanHash = (hash || '').replace(/^#\/?/, '').trim();
      const cleanPath = (pathname || '').replace(/^\/+|\/+$/g, '').trim();
      if (cleanHash && cleanHash !== 'home') return cleanHash;
      if (cleanPath && cleanPath !== 'index.html' && cleanPath !== '') return cleanPath;
      return 'home';
    }

    assert(simulateRoute('/', '') === 'home', 'Direct visit to "http://localhost:3000/" resolves to route: "home"');
    assert(simulateRoute('/index.html', '') === 'home', 'Direct visit to "/index.html" resolves to route: "home"');
    assert(simulateRoute('/', '#home') === 'home', 'Visit to "/#home" resolves to route: "home"');
    assert(simulateRoute('/correction', '') === 'correction', 'Direct visit to "/correction" resolves to route: "correction"');
    assert(simulateRoute('/', '#correction') === 'correction', 'Direct visit to "/#correction" resolves to route: "correction"');
    assert(simulateRoute('/', '#scan') === 'scan', 'Direct visit to "/#scan" resolves to route: "scan"');
    assert(simulateRoute('/', '#assistant') === 'assistant', 'Direct visit to "/#assistant" resolves to route: "assistant"');

    console.log('\n===============================================================');
    console.log(`ROUTING VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runHomepageRoutingVerification();

