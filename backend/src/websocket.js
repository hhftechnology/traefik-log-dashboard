export function setupWebSocket(wss, logParser) {
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    // Send initial stats
    logParser.getStats().then(stats => {
      ws.send(JSON.stringify({
        type: 'stats',
        data: stats
      }));
    });

    // Send recent logs
    logParser.getLogs({ page: 1, limit: 50 }).then(result => {
      ws.send(JSON.stringify({
        type: 'logs',
        data: result.logs
      }));
    });

    // Handle new logs
    const newLogHandler = (log) => {
      ws.send(JSON.stringify({
        type: 'newLog',
        data: log
      }));
    };

    // Subscribe to new logs
    logParser.on('newLog', newLogHandler);

    // Update stats every 5 seconds
    const statsInterval = setInterval(async () => {
      if (ws.readyState === ws.OPEN) {
        const stats = await logParser.getStats();
        ws.send(JSON.stringify({
          type: 'stats',
          data: stats
        }));
      }
    }, 5000);

    // Handle client messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'getLogs':
            const logs = await logParser.getLogs(data.params || {});
            ws.send(JSON.stringify({
              type: 'logs',
              data: logs
            }));
            break;
            
          case 'getStats':
            const stats = await logParser.getStats();
            ws.send(JSON.stringify({
              type: 'stats',
              data: stats
            }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      logParser.removeListener('newLog', newLogHandler);
      clearInterval(statsInterval);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}