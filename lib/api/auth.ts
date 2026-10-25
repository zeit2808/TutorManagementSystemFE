import { apiRequest, clearAccessToken, setAccessToken } from "./http";
import type {
  AcceptedInvitation,
  CenterInvitation,
  TokenResponse,
} from "./types";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AcceptInvitationRequest {
  token: string;
  username: string;
  password: string;
  phoneNumber: string;
}

async function acceptTokens(promise: Promise<TokenResponse>) {
  const tokens = await promise;
  setAccessToken(tokens);
  return tokens;
}

export const authApi = {
  login(input: LoginRequest) {
    return acceptTokens(apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      auth: "none",
      body: input,
    }));
  },

  googleLogin(idToken: string) {
    return acceptTokens(apiRequest<TokenResponse>("/auth/google", {
      method: "POST",
      auth: "none",
      body: { idToken },
    }));
  },

  linkGoogle(idToken: string, currentPassword: string) {
    return apiRequest<{ linked: boolean }>("/auth/google/link", {
      method: "POST",
      body: { idToken, currentPassword },
    });
  },

  changePassword(input: ChangePasswordRequest) {
    return acceptTokens(apiRequest<TokenResponse>("/auth/password/change", {
      method: "POST",
      body: input,
    }));
  },

  forgotPassword(email: string) {
    return apiRequest<void>("/auth/password/forgot", {
      method: "POST",
      auth: "none",
      body: { email },
    });
  },

  async resetPassword(input: ResetPasswordRequest) {
    const result = await apiRequest<void>("/auth/password/reset", {
      method: "POST",
      auth: "none",
      body: input,
    });
    clearAccessToken();
    return result;
  },

  verifyEmail(token: string) {
    return apiRequest<void>("/auth/verify-email", {
      method: "POST",
      auth: "none",
      body: { token },
    });
  },

  resendVerificationEmail(email: string) {
    return apiRequest<void>("/auth/resend-verification-email", {
      method: "POST",
      auth: "none",
      body: { email },
    });
  },

  acceptInvitation(input: AcceptInvitationRequest) {
    return apiRequest<AcceptedInvitation>("/auth/invitations/accept", {
      method: "POST",
      auth: "none",
      body: input,
    });
  },

  inviteCenterOwner(centerId: string, email: string) {
    return apiRequest<CenterInvitation>(`/platform/centers/${centerId}/invitations`, {
      method: "POST",
      body: { email },
    });
  },

  async logout() {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST", auth: "none" });
    } finally {
      clearAccessToken();
    }
  },

  async logoutAll() {
    try {
      await apiRequest<void>("/auth/logout-all", { method: "POST" });
    } finally {
      clearAccessToken();
    }
  },
};
