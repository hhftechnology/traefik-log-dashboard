export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { backgroundScheduler } = await import('./lib/services/background-scheduler');
    const { initDatabase, syncEnvAgents } = await import('./lib/db/database');
    
    // Initialize DB and sync env agents
    initDatabase();
    syncEnvAgents();
    
    // Start the scheduler
    console.log('[Instrumentation] Starting background scheduler...');
    backgroundScheduler.start();
  }
}
