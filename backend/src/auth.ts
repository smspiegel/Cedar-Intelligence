import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppConfig } from "./config.js";

export type AuthContext = { tenantId: string; subject?: string; roles: string[] };

export interface AuthProvider {
  authenticate(authorization: string | undefined): Promise<AuthContext | null>;
}

class DevelopmentAuthProvider implements AuthProvider {
  constructor(private config: AppConfig) {}
  async authenticate(authorization: string | undefined) {
    if (authorization !== `Bearer ${this.config.API_TOKEN}`) return null;
    return { tenantId: this.config.TENANT_ID, roles: ["admin"] };
  }
}

class JwtAuthProvider implements AuthProvider {
  private keys: ReturnType<typeof createRemoteJWKSet>;
  constructor(private config: AppConfig) {
    if (!config.AUTH_ISSUER || !config.AUTH_JWKS_URL) {
      throw new Error("JWT authentication requires AUTH_ISSUER and AUTH_JWKS_URL");
    }
    this.keys = createRemoteJWKSet(new URL(config.AUTH_JWKS_URL));
  }
  async authenticate(authorization: string | undefined): Promise<AuthContext | null> {
    if (!authorization?.startsWith("Bearer ")) return null;
    try {
      const { payload } = await jwtVerify(authorization.slice("Bearer ".length), this.keys, {
        issuer: this.config.AUTH_ISSUER,
        ...(this.config.AUTH_AUDIENCE ? { audience: this.config.AUTH_AUDIENCE } : {}),
      });
      const organization = payload.o;
      const clerkOrganizationId = organization && typeof organization === "object" && "id" in organization ? organization.id : undefined;
      const tenantId = payload[this.config.AUTH_TENANT_CLAIM] ?? (this.config.AUTH_TENANT_CLAIM === "org_id" ? clerkOrganizationId : undefined);
      if (typeof tenantId !== "string" || tenantId.length === 0) return null;
      const roles = Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : [];
      return { tenantId, subject: payload.sub, roles };
    } catch {
      return null;
    }
  }
}

export const createAuthProvider = (config: AppConfig): AuthProvider =>
  config.AUTH_MODE === "jwt" ? new JwtAuthProvider(config) : new DevelopmentAuthProvider(config);
