import { groupSchema, type GroupInput } from '../../shared/contracts';
import { apiRequest } from './api';
export const createGroup = (id: string, group: GroupInput) =>
  apiRequest('/groups', groupSchema, { method: 'POST', body: { id, group } });
export const updateGroup = (id: string, group: GroupInput, expectedVersion: number) =>
  apiRequest(`/groups/${id}`, groupSchema, { method: 'PUT', body: { group, expectedVersion } });
export const reconcileGroup = (id: string) =>
  apiRequest(`/groups/${id}/reconcile`, groupSchema, { method: 'POST' });
