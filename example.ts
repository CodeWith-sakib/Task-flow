import { Application } from './src/index';

async function main() {
  const app = new Application();

  // Register task handlers
  app.getTaskService().registerHandler('send_email', async (payload) => {
    console.log('Sending email to:', payload.to);
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    return { emailSent: true, to: payload.to };
  });

  app.getTaskService().registerHandler('process_data', async (payload) => {
    console.log('Processing data:', payload);
    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return { processed: true, itemCount: payload.items?.length || 0 };
  });

  app.getTaskService().registerHandler('webhook_call', async (payload) => {
    console.log('Calling webhook:', payload.url);
    // Simulate webhook call
    await new Promise(resolve => setTimeout(resolve, 200));
    return { statusCode: 200, url: payload.url };
  });

  // Start server on port 3000
  await app.start(3000);
}

main().catch(console.error);
