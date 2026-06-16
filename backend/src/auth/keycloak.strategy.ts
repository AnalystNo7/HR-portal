import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface JwtPayload {
  sub: string;
  email: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  realm_roles?: string[];
  realm_access?: { roles: string[] };
}

export interface AuthUser {
  keycloakId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const keycloakPublicUrl = process.env.KEYCLOAK_PUBLIC_URL || keycloakUrl;
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      }),
      issuer: `${keycloakPublicUrl}/realms/${realm}`,
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): AuthUser {
    const roles = payload.realm_roles ||
      payload.realm_access?.roles ||
      [];

    return {
      keycloakId: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles: roles.filter(r => ['employee', 'manager', 'hr', 'admin'].includes(r)),
    };
  }
}
