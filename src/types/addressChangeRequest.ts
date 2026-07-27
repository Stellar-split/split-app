export type AddressChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AddressChangeRequest {
  id: string;
  invoiceId: string;
  recipientId: string;
  oldAddress: string;
  newAddress: string;
  justification: string;
  status: AddressChangeRequestStatus;
  requestedAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface AddressChangeRequestInput {
  oldAddress: string;
  newAddress: string;
  justification: string;
}
