import websocket from '../services/websocket';
import { useLogsStore } from '../stores/logs';
import { useTasksStore } from '../stores/tasks';
import { useInvoicesStore } from '../stores/invoices';
import { useNodeStore } from '../stores/node';

let initialized = false;

export function useRealtime() {
  const logsStore = useLogsStore();
  const tasksStore = useTasksStore();
  const invoicesStore = useInvoicesStore();
  const nodeStore = useNodeStore();

  const init = (): void => {
    if (initialized) return;
    initialized = true;

    websocket.on('connected', () => {
      nodeStore.setConnected(true);
      websocket.authenticate(localStorage.getItem('app_session_token'));
    });

    websocket.on('disconnected', () => {
      nodeStore.setConnected(false);
    });

    websocket.on('log', (data) => {
      logsStore.addLog(data as { timestamp?: string; level?: string; message?: string; raw?: string });
    });

    websocket.on('task', (data) => {
      const payload = data as { event?: string };
      if (payload?.event === 'received') {
        tasksStore.addTask(data as never);
      } else if (payload?.event) {
        tasksStore.updateTask(data as never);
      }
    });

    websocket.on('invoice', (data) => {
      invoicesStore.addInvoice(data as never);
    });

    websocket.on('node_status', (data) => {
      nodeStore.updateFromWebSocket(data as Record<string, unknown>);
    });

    websocket.on('semaphore', (data) => {
      const payload = data as { current?: number; total?: number };
      if (typeof payload.current === 'number' && typeof payload.total === 'number') {
        nodeStore.updateSlots({ current: payload.current, total: payload.total });
      }
    });
  };

  const connect = (): void => {
    websocket.connect();
  };

  const disconnect = (): void => {
    websocket.disconnect();
    nodeStore.setConnected(false);
  };

  const reauth = (): void => {
    websocket.authenticate(localStorage.getItem('app_session_token'));
  };

  return {
    init,
    connect,
    disconnect,
    reauth
  };
}
