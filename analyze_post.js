const fs = require('fs');
const FormData = require('form-data');
(async function() {
  const fetch = (await import('node-fetch')).default;
  const imgPath = 'C:/Users/Shakin Sakthi.B.O/.gemini/antigravity-ide/brain/484d3f23-c150-4e72-952b-1372f7e7a611/bad_ui_mockup_1780822844736.png';
  if (!fs.existsSync(imgPath)) {
    console.error('Image not found:', imgPath);
    process.exit(1);
  }
  const form = new FormData();
  form.append('screenshot', fs.createReadStream(imgPath));

  try {
    const res = await fetch('http://localhost:3001/api/analyze', { method: 'POST', body: form });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Request failed:', e);
  }
})();
