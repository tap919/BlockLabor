import { mockIntegrations } from '../mocks/data';
import { IntegrationSetting } from '../types/domain';

export const integrationService = {
  getAll: (): IntegrationSetting[] => mockIntegrations,
  getById: (id: string): IntegrationSetting | undefined => mockIntegrations.find(int => int.id === id),
};
