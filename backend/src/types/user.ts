export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FLAGGED = 'FLAGGED',
}

export enum RiskDecision {
  ALLOW = 'ALLOW',
  FLAG = 'FLAG',
}

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: Date;
  verifiedAt?: Date;
  riskDecision?: RiskDecision;
  riskCheckAt?: Date;
  riskScore?: number;
  riskReasoning?: string;
  riskConfidence?: number;
}

export interface SignupRequest {
  email: string;
  name: string;
}

