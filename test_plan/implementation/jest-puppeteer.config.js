module.exports = {
  launch: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    devtools: process.env.DEVTOOLS === 'true',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=VizDisplayCompositor'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  },
  browserContext: 'default',
  server: {
    command: 'echo "Frontend should be running on localhost:3001"',
    port: 3001,
    launchTimeout: 30000,
    debug: true
  }
};