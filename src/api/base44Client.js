import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "6909eb511f749a49b63df48c", 
  requiresAuth: true // Ensure authentication is required for all operations
});
