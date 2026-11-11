import { useContext } from 'react';
import { RegistryContext } from '@/near/registry-context';

/// Accesses the active registry provider and fails clearly if it is missing.
export function useRegistry() {
  const value = useContext(RegistryContext);
  if (!value) {
    throw new Error('useRegistry must be used inside RegistryProvider.');
  }
  return value;
}
