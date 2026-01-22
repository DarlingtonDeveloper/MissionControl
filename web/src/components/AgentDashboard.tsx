import { useState } from 'react';
import { AgentTerminal } from './AgentTerminal';

interface Agent {
  id: string;
  name: string;
  sessionName: string;
  status: 'running' | 'idle' | 'error';
}

interface AgentDashboardProps {
  agents: Agent[];
  defaultLayout?: 'single' | 'grid';
}

export function AgentDashboard({ agents, defaultLayout = 'single' }: AgentDashboardProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(
    agents[0]?.id ?? null
  );
  const [layout, setLayout] = useState<'single' | 'grid'>(defaultLayout);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});

  const handleConnectionChange = (agentId: string, connected: boolean) => {
    setConnectionStatus(prev => ({ ...prev, [agentId]: connected }));
  };

  const getStatusColor = (agent: Agent) => {
    if (connectionStatus[agent.id] === false) return 'bg-red-500';
    if (agent.status === 'running') return 'bg-green-500';
    if (agent.status === 'error') return 'bg-red-500';
    return 'bg-gray-500';
  };

  if (layout === 'grid') {
    return (
      <div className="h-full flex flex-col bg-gray-900">
        <div className="flex justify-between items-center p-2 border-b border-gray-700">
          <h2 className="font-semibold text-white">Agent Terminals</h2>
          <button
            onClick={() => setLayout('single')}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Single View
          </button>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2 p-2 overflow-auto">
          {agents.map(agent => (
            <div key={agent.id} className="flex flex-col border border-gray-700 rounded">
              <div className="flex items-center gap-2 p-2 bg-gray-800">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(agent)}`} />
                <span className="font-medium text-white">{agent.name}</span>
              </div>
              <div className="flex-1 min-h-[300px]">
                <AgentTerminal
                  sessionName={agent.sessionName}
                  onConnectionChange={(connected) => handleConnectionChange(agent.id, connected)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex justify-between items-center p-2 border-b border-gray-700">
        <div className="flex gap-2">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`px-3 py-1 rounded flex items-center gap-2 ${
                selectedAgent === agent.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${getStatusColor(agent)}`} />
              {agent.name}
            </button>
          ))}
        </div>
        {agents.length > 1 && (
          <button
            onClick={() => setLayout('grid')}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Grid View
          </button>
        )}
      </div>
      <div className="flex-1">
        {selectedAgent && (
          <AgentTerminal
            sessionName={agents.find(a => a.id === selectedAgent)!.sessionName}
            onConnectionChange={(connected) => handleConnectionChange(selectedAgent, connected)}
          />
        )}
      </div>
    </div>
  );
}
