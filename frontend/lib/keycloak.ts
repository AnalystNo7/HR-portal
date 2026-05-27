import Keycloak from 'keycloak-js';

let keycloakInstance: Keycloak | null = null;

export function getKeycloak(): Keycloak {
  if (typeof window === 'undefined') {
    throw new Error('Keycloak can only be initialized on the client');
  }

  if (!keycloakInstance) {
    keycloakInstance = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'hr-portal',
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'hr-portal-app',
    });
  }

  return keycloakInstance;
}

export function getToken(): string | undefined {
  return keycloakInstance?.token;
}

export type UserRole = 'employee' | 'manager' | 'hr' | 'admin';

export function getRolesFromToken(kc: Keycloak): UserRole[] {
  const parsed = kc.tokenParsed as Record<string, unknown> | undefined;
  if (!parsed) return [];

  const realmRoles = (parsed.realm_roles as string[]) ||
    (parsed.realm_access as { roles: string[] })?.roles || [];

  return realmRoles.filter((r): r is UserRole =>
    ['employee', 'manager', 'hr', 'admin'].includes(r)
  );
}

export function pickHighestRole(roles: UserRole[]): UserRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('hr')) return 'hr';
  if (roles.includes('manager')) return 'manager';
  return 'employee';
}
