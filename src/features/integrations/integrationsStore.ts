import { create } from 'zustand';
import { IntegrationSetting } from '../../shared/types/domain';
import { mockIntegrations } from '../../shared/mocks/data';

interface IntegrationsStore {
  integrations: IntegrationSetting[];
  toggleIntegration: (id: string) => void;
}

export const useIntegrationsStore = create<IntegrationsStore>((set) => ({
  integrations: mockIntegrations,
  toggleIntegration: (id) =>
    set((state) => ({
      integrations: state.integrations.map((node) =>
        node.id === id
          ? {
              ...node,
              status: node.status === 'connected' ? 'disconnected' : 'connected',
              lastSync: new Date().toISOString(),
            }
          : node
      ),
    })),
}));
