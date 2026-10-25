export interface MentorGroupOwner {
  _id: string;
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
}

export interface MentorGroup {
  _id: string;
  name: string;
  description?: string;
  coverImage?: string | null;
  memberCount: number;
  owner: MentorGroupOwner | null;
  ownerId?: string | MentorGroupOwner | null;
  linkedGroups: { _id: string; name: string; groupType?: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MentorOption {
  _id: string;
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
  headline?: string;
}

export interface CommunityOption {
  _id: string;
  name: string;
  groupType?: string;
  memberCount?: number;
}

export interface MentorGroupMember {
  _id: string;
  userId: string;
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
  role: string;
  isDirect: boolean;
  sourceGroupId?: string | null;
  sourceGroupName?: string | null;
  joinedAt?: string;
}

export interface UserCandidate {
  _id: string;
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
}
