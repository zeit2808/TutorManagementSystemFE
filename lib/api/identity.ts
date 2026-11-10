import { apiRequest } from "./http";
import type {
  AcceptedMembership,
  AssignableMemberRole,
  CenterContext,
  CenterMember,
  CurrentUser,
  EmailChangeStarted,
  InvitationPreview,
  MemberInvitation,
  UpdateMyProfileInput,
} from "./types";

export const identityApi = {
  /** The signed-in account with roles read from the database and linked sign-in methods. */
  me() {
    return apiRequest<CurrentUser>("/me");
  },

  /** Display name and phone; returns the refreshed account. */
  updateProfile(input: UpdateMyProfileInput) {
    return apiRequest<CurrentUser>("/me/profile", { method: "PUT", body: input });
  },

  /** Step 1 of changing the sign-in email: re-checks the password, mails an 8-digit code to the new address. */
  requestEmailChange(newEmail: string, currentPassword: string) {
    return apiRequest<EmailChangeStarted>("/me/email/change", { method: "POST", body: { newEmail, currentPassword } });
  },

  /** Step 2: the code from the new inbox; returns the account with its new email. */
  confirmEmailChange(newEmail: string, otp: string) {
    return apiRequest<CurrentUser>("/me/email/confirm", { method: "POST", body: { newEmail, otp } });
  },

  myCenters() {
    return apiRequest<CenterContext[]>("/me/centers");
  },

  /** Owner and admins see the roster; only the owner changes it. */
  listMembers(centerId: string) {
    return apiRequest<CenterMember[]>(`/centers/${centerId}/members`);
  },

  listMemberInvitations(centerId: string) {
    return apiRequest<MemberInvitation[]>(`/centers/${centerId}/member-invitations`);
  },

  inviteMember(centerId: string, email: string, role: AssignableMemberRole) {
    return apiRequest<MemberInvitation>(`/centers/${centerId}/member-invitations`, {
      method: "POST",
      body: { email, role },
    });
  },

  /** Sends the invitation again with a new 48-hour link; the old link stops working. */
  resendMemberInvitation(centerId: string, invitationId: string) {
    return apiRequest<MemberInvitation>(`/centers/${centerId}/member-invitations/${invitationId}/resend`, {
      method: "POST",
    });
  },

  /** Platform: open invitations of a center (including expired); admins manage only the owner invitation. */
  platformListInvitations(centerId: string) {
    return apiRequest<MemberInvitation[]>(`/platform/centers/${centerId}/invitations`);
  },
  platformRevokeInvitation(centerId: string, invitationId: string) {
    return apiRequest<MemberInvitation>(`/platform/centers/${centerId}/invitations/${invitationId}/revoke`, {
      method: "POST",
    });
  },
  platformResendInvitation(centerId: string, invitationId: string) {
    return apiRequest<MemberInvitation>(`/platform/centers/${centerId}/invitations/${invitationId}/resend`, {
      method: "POST",
    });
  },

  revokeMemberInvitation(centerId: string, invitationId: string) {
    return apiRequest<MemberInvitation>(`/centers/${centerId}/member-invitations/${invitationId}/revoke`, {
      method: "POST",
    });
  },

  changeMemberRole(centerId: string, membershipId: string, role: AssignableMemberRole) {
    return apiRequest<CenterMember>(`/centers/${centerId}/members/${membershipId}/role`, {
      method: "PUT",
      body: { role },
    });
  },

  setMemberActive(centerId: string, membershipId: string, active: boolean) {
    return apiRequest<CenterMember>(
      `/centers/${centerId}/members/${membershipId}/${active ? "reactivate" : "deactivate"}`,
      { method: "POST" },
    );
  },

  previewInvitation(token: string) {
    return apiRequest<InvitationPreview>("/auth/invitations/preview", {
      method: "POST",
      auth: "none",
      body: { token },
    });
  },

  /** Accept with the signed-in account (its email must be the invited one). */
  acceptInvitationAsMember(token: string) {
    return apiRequest<AcceptedMembership>("/me/invitations/accept", {
      method: "POST",
      body: { token },
    });
  },

  centerContext(centerId: string) {
    return apiRequest<CenterContext>(`/centers/${centerId}/context`);
  },
};
