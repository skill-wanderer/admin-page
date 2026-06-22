import { hasAnyRole } from './auth.service';

describe('hasAnyRole', () => {
  it('allows access when the account has any one accepted admin role', () => {
    expect(hasAnyRole(['CLIENT'], ['CRM', 'CLIENT', 'CONTENT'])).toBe(true);
  });

  it('denies access when none of the account roles are accepted', () => {
    expect(hasAnyRole(['offline_access'], ['CRM', 'CLIENT'])).toBe(false);
  });
});
