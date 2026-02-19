import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Check if we're on a public route that doesn't need auth
const isPublicRoute = () => {
  const publicPaths = ['/pedir'];
  return typeof window !== 'undefined' && publicPaths.some(path => window.location.pathname.startsWith(path));
};

// Create a client - disable auto-auth for public routes
export const base44 = createClient({
  appId: "6909eb511f749a49b63df48c", 
  requiresAuth: !isPublicRoute() // Only require auth for non-public routes
});
