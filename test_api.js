const fs = require('fs');
const path = require('path');

async function testLevel2() {
  const FormData = require('form-data');
  const fetch = (await import('node-fetch')).default;

  const img1Path = 'C:\\Users\\Shakin Sakthi.B.O\\.gemini\\antigravity-ide\\brain\\60a3a80d-7f2f-41fe-9550-94a3f56a6e4e\\l1_dashboard_home_1780827333939.png';
  const img2Path = 'C:\\Users\\Shakin Sakthi.B.O\\.gemini\\antigravity-ide\\brain\\60a3a80d-7f2f-41fe-9550-94a3f56a6e4e\\settings_panel_open_1780827347976.png';

  const form = new FormData();
  form.append('baseline', fs.createReadStream(img1Path));
  form.append('current', fs.createReadStream(img2Path));
  form.append('diffThreshold', '15');

  try {
    const res = await fetch('http://localhost:3001/api/audit-site', {
      method: 'POST',
      body: form
    });
    
    const data = await res.json();
    fs.writeFileSync('test_output.json', JSON.stringify(data, null, 2));
    console.log('Success! Saved to test_output.json');
  } catch(e) {
    console.error('Error:', e);
  }
}

testLevel2();
