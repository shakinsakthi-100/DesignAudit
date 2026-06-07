const fs = require('fs');
(async function(){
  const FormData = require('form-data');
  const fetch = (await import('node-fetch')).default;

  const baseline = 'C:/Users/Shakin Sakthi.B.O/.gemini/antigravity-ide/brain/484d3f23-c150-4e72-952b-1372f7e7a611/good_ui_mockup_1780822860382.png';
  const current = 'C:/Users/Shakin Sakthi.B.O/.gemini/antigravity-ide/brain/484d3f23-c150-4e72-952b-1372f7e7a611/bad_ui_mockup_1780822844736.png';

  if (!fs.existsSync(baseline) || !fs.existsSync(current)) {
    console.error('One or both image paths not found.');
    process.exit(1);
  }

  const form = new FormData();
  form.append('baseline', fs.createReadStream(baseline));
  form.append('current', fs.createReadStream(current));
  form.append('diffThreshold', '15');
  form.append('minArea', '80');

  try {
    const res = await fetch('http://localhost:3001/api/analyze-regression', { method: 'POST', body: form });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Request failed:', e);
  }
})();
