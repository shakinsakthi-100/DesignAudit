const fs = require('fs');
const path = require('path');

async function runTest() {
  const badImage = 'C:/Users/Shakin Sakthi.B.O/.gemini/antigravity-ide/brain/484d3f23-c150-4e72-952b-1372f7e7a611/bad_ui_mockup_1780822844736.png';
  const goodImage = 'C:/Users/Shakin Sakthi.B.O/.gemini/antigravity-ide/brain/484d3f23-c150-4e72-952b-1372f7e7a611/good_ui_mockup_1780822860382.png';

  console.log('Testing AIVAR Backend Analysis with Jimp-based custom canvas...');

  const { generateReport } = require('./analysis/reportGenerator');

  console.log('\n--- Analyzing Bad UI Mockup ---');
  try {
    const badReport = await generateReport(badImage, { filename: 'bad_ui.png', size: fs.statSync(badImage).size, format: 'PNG' });
    console.log('Success!');
    console.log('Dimensions:', badReport.image.dimensions);
    console.log('Total Findings:', badReport.summary.totalFindings);
    console.log('Overall Score:', badReport.summary.overallScore);
    console.log('Findings sample (first 2):');
    badReport.findings.slice(0, 2).forEach(f => {
      console.log(`- [${f.severity.toUpperCase()}] ${f.principle}: ${f.description}`);
    });
  } catch (error) {
    console.error('Error analyzing bad UI:', error);
  }

  console.log('\n--- Analyzing Good UI Mockup ---');
  try {
    const goodReport = await generateReport(goodImage, { filename: 'good_ui.png', size: fs.statSync(goodImage).size, format: 'PNG' });
    console.log('Success!');
    console.log('Dimensions:', goodReport.image.dimensions);
    console.log('Total Findings:', goodReport.summary.totalFindings);
    console.log('Overall Score:', goodReport.summary.overallScore);
    console.log('Findings sample (first 2):');
    goodReport.findings.slice(0, 2).forEach(f => {
      console.log(`- [${f.severity.toUpperCase()}] ${f.principle}: ${f.description}`);
    });
  } catch (error) {
    console.error('Error analyzing good UI:', error);
  }
}

runTest();
