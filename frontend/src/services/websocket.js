// Create a new file if it doesn't exist yet or add to existing WebSocket handling

export const setupWebSocket = (url) => {
  const ws = new WebSocket(url);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'actuator_update') {
        // Dispatch an event that components can listen for
        const updateEvent = new CustomEvent('actuator-update', {
          detail: message.data
        });
        window.dispatchEvent(updateEvent);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Add reconnection logic if needed
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
};

// Add listener helpers
export const addActuatorUpdateListener = (callback) => {
  window.addEventListener('actuator-update', (event) => {
    callback(event.detail);
  });
};

export const removeActuatorUpdateListener = (callback) => {
  window.removeEventListener('actuator-update', callback);
};
