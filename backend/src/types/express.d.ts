declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        businessId: string;
        permissions: string[];
        isStaff: boolean;
      };
    }
  }
}

export {};
