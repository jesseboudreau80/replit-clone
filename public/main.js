const consoleEl = document.getElementById('console-output');
const runButton = document.getElementById('run-btn');

function appendEvent({ type, message }) {
  const div = document.createElement('div');
  div.innerHTML = `<span class="event-${type}">[${type.toUpperCase()}]</span> ${message}`;
  consoleEl.appendChild(div);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function connectStream() {
  const source = new EventSource('/api/events');
  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      appendEvent(data);
    } catch (err) {
      console.error('Failed to parse event', err);
    }
  };
  source.onerror = () => {
    appendEvent({ type: 'stderr', message: 'Connection lost. Retrying...' });
    source.close();
    setTimeout(connectStream, 1000);
  };
}

async function runAgent() {
  consoleEl.innerHTML = '';
  appendEvent({ type: 'status', message: 'Starting agent...' });
  try {
    await fetch('/api/run', { method: 'POST' });
  } catch (err) {
    appendEvent({ type: 'stderr', message: 'Failed to start agent run.' });
  }
}

runButton.addEventListener('click', runAgent);
connectStream();
