import { describe, expect, it } from 'vitest';
import { roleDetails } from './role-details';
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