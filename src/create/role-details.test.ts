import { describe, expect, it } from 'vitest';
import { firstRoleMissingDetails, roleDetails } from './role-details';
describe('open role details are required except timing', () => {
  it('flags the first named role missing a required detail', () => {
    expect(firstRoleMissingDetails([{ name: 'Model', description: 'Photos', requirements: 'Portfolio', location: 'Toronto' }])).toBeNull();
    expect(firstRoleMissingDetails([{ name: 'Model', description: 'Photos', requirements: 'Portfolio' }])?.name).toBe('Model');
    expect(firstRoleMissingDetails([{ name: 'Model', description: 'Photos', location: 'Toronto' }])?.name).toBe('Model');
    expect(firstRoleMissingDetails([{ name: 'Model', requirements: 'Portfolio', location: 'Toronto' }])?.name).toBe('Model');
  });
  it('ignores unnamed draft rows and accepts whitespace-only only when blank', () => {
    expect(firstRoleMissingDetails([{ name: '  ' }])).toBeNull();
    expect(firstRoleMissingDetails([{ name: 'Editor', description: '  ', requirements: 'x', location: 'y' }])?.name).toBe('Editor');
  });
  it('treats timing as optional', () => {
    expect(firstRoleMissingDetails([{ name: 'Videographer', description: 'Film', requirements: 'Own camera', location: 'Remote', timing: '' }])).toBeNull();
  });
});
describe('optional opening details', () => {
  it('retains all supplied details through save and restore', () => {
    const details = { description: ' Shoot campaign photos ', requirements: 'Portfolio required', location: 'Toronto', timing: 'Two days' };
    expect(roleDetails(JSON.parse(JSON.stringify(roleDetails(details))))).toEqual({ description: 'Shoot campaign photos', requirements: 'Portfolio required', location: 'Toronto', timing: 'Two days' });
  });
  it('supports old roles without details and omits blank fields', () => {
    expect(roleDetails({})).toEqual({});
    expect(roleDetails({ description: '  ', location: 'Remote' })).toEqual({ location: 'Remote' });
  });
});