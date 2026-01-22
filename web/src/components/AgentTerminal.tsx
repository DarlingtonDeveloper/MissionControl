import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface AgentTerminalProps {
  sessionName: string;
  readOnly?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  className?: string;
}

export function AgentTerminal({
  sessionName,
  readOnly = false,
  onConnectionChange,
  className = '',
}: AgentTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const connect = useCallback(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: !readOnly,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#eaeaea',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#1a1a2e',
        red: '#ff6b6b',
        green: '#4ecdc4',
        yellow: '#ffe66d',
        blue: '#4a90d9',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#eaeaea',
        brightBlack: '#666666',
        brightRed: '#ff8a8a',
        brightGreen: '#7ee7df',
        brightYellow: '#fff59d',
        brightBlue: '#82b1ff',
        brightMagenta: '#ddb3f8',
        brightCyan: '#a8e8ff',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal?session=${sessionName}&readonly=${readOnly}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      terminal.writeln(`\x1b[32mConnected to ${sessionName}\x1b[0m\r\n`);
      onConnectionChange?.(true);

      // Send initial size
      const { cols, rows } = terminal;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        terminal.write(new Uint8Array(event.data));
      } else {
        terminal.write(event.data);
      }
    };

    ws.onclose = () => {
      terminal.writeln('\r\n\x1b[31mDisconnected\x1b[0m');
      onConnectionChange?.(false);
    };

    ws.onerror = () => {
      terminal.writeln('\r\n\x1b[31mConnection error\x1b[0m');
    };

    // Handle user input
    if (!readOnly) {
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    return () => {
      ws.close();
      terminal.dispose();
    };
  }, [sessionName, readOnly, onConnectionChange]);

  useEffect(() => {
    const cleanup = connect();

    // Handle window resize
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cleanup?.();
      window.removeEventListener('resize', handleResize);
    };
  }, [connect]);

  return (
    <div
      ref={terminalRef}
      className={`h-full w-full ${className}`}
      style={{
        padding: '8px',
        backgroundColor: '#1a1a2e',
        borderRadius: '8px',
      }}
    />
  );
}
