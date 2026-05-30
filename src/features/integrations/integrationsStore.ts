import { create } from 'zustand';
import { IntegrationSetting } from '../../shared/types/domain';
import { integrationService } from '../../shared/services/integrations.service';

interface IntegrationsStore {
  integrations: IntegrationSetting[];
  toggleIntegration: (id: string) => void;
}

export const useIntegrationsStore = create<IntegrationsStore>((set) => ({
  integrations: [],
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
