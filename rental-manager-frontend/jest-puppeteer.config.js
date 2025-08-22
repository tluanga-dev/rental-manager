module.exports = {
  launch: {
    headless: 'new', // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--remote-debugging-port=9222'
    ],
    defaultViewport: {
      width: 1280,
      height: 720
    }
  }
  // No server configuration - assume servers are already running
};