import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';
export interface Author {
    _id: string;
    displayName: string;
    photoURL?: string;
    subscriptionPlan?: string;
    isMentor?: boolean;
}

export interface Post {
    _id: string;
    content: string;
    images?: string[];
    video?: string;
    audio?: string;
    postType?: 'discussion' | 'question' | 'mentor';
    title?: string | null;
    isResolved?: boolean;
    acceptedCommentId?: string | null;
    assignedMentorId?: string | null;
    voteCount?: number;
    userVoted?: boolean;
    viewerCanManageQuestion?: boolean;
    likeCount: number;
    commentCount: number;
    isPinned: boolean;
    userLiked: boolean;
    author: Author;
    createdAt: string;
    updatedAt: string;
    timeAgo?: string; // Calculated on frontend
    tags?: string[];
}

export type CommunityPostType = 'discussion' | 'question';
export type FeedPostType = 'discussion' | 'question' | 'mentor';
export type QuestionFilter = 'all' | 'unanswered' | 'resolved' | 'mine';

export type MentorQuestionFilter = 'all' | 'unanswered' | 'resolved';

export interface MentorGroup {
    _id: string;
    name: string;
    groupType?: string;
    category?: string | null;
    planSlug?: string | null;
}

export interface Mentor {
    _id: string;
    userId: string;
    displayName: string;
    photoURL?: string | null;
    headline?: string;
    bio?: string;
    expertise?: string[];
    languages?: string[];
    groups: MentorGroup[];
    isVerified?: boolean;
    isActive?: boolean;
}

export interface MentorDetail {
    mentor: Mentor;
    stats: {
        questionsAssigned: number;
        answersGiven: number;
    };
    recentQuestions: Post[];
    recentPosts: Post[];
}

export interface MentorGroupMember {
    _id: string;
    userId: string;
    displayName: string;
    photoURL?: string | null;
    role: string;
    isDirect: boolean;
    sourceGroupId?: string | null;
    sourceGroupName?: string | null;
    joinedAt: string;
}

export interface MentorGroupCandidate {
    _id: string;
    displayName: string;
    photoURL?: string | null;
}

export interface Group {
    _id: string;
    name: string;
    description?: string;
    memberCount: number;
    coverImage?: string;
    groupType: 'plan' | 'category' | 'course' | 'mentor';
    planSlug?: string;
    category?: string;
    parentGroupId?: string | null;
    course: {
        _id: string;
        title: string;
        category: string;
        thumbnail?: string;
    } | string;
    isPublic?: boolean;
    ownerId?: string | null;
    linkedGroupIds?: string[];
    isOwner?: boolean;
    isPrivate?: boolean;
    joinedAt: string;
    role: 'member' | 'mentor' | 'moderator' | 'admin';
}

export interface PlanGroup {
    _id: string;
    name: string;
    description?: string;
    memberCount: number;
    groupType: 'plan';
    planSlug: string;
    category?: string | null;
    parentGroupId?: string | null;
    coverImage?: string;
    course?: any;
    isPublic?: boolean;
    joinedAt: string;
    role: 'member' | 'mentor' | 'moderator' | 'admin';
    subgroups: Group[];
}

export interface Comment {
    _id: string;
    content: string;
    parentCommentId?: string | null;
    author: Author;
    likeCount: number;
    replyCount?: number;
    isAccepted?: boolean;
    userLiked: boolean;
    createdAt: string;
    timeAgo?: string;
}

interface CommunityState {
    posts: Post[];
    groups: Group[];
    planGroups: PlanGroup[];
    mentorGroups: Group[];
    ownedGroups: Group[];
    mentorMemberGroups: Group[];
    generalGroup: Group | null;
    currentGroup: Group | null;
    comments: { [postId: string]: Comment[] };
    mentors: Mentor[];
    mentorDetail: MentorDetail | null;
    mentorMe: { isMentor: boolean; profile: Mentor | null };
    mentorQuestions: Post[];
    mentorPosts: Post[];
    mentorPostsLoading: boolean;
    mentorLoading: boolean;
    mentorError: string | null;
    mentorGroupMembers: MentorGroupMember[];
    mentorGroupCandidates: MentorGroupCandidate[];
    isLoading: boolean;
    error: string | null;
    communityAccessDenied: boolean;
    postingBlocked: boolean;

    fetchMyGroups: () => Promise<void>;
    fetchGroupPosts: (groupId: string, page?: number, postType?: FeedPostType, status?: QuestionFilter) => Promise<void>;
    fetchAllPosts: (page?: number, postType?: FeedPostType, status?: QuestionFilter) => Promise<void>;
    createPost: (
        groupId: string,
        content: string,
        images?: string[],
        tags?: string[],
        options?: { postType?: FeedPostType; title?: string; assignedMentorId?: string | null }
    ) => Promise<boolean>;
    togglePostLike: (postId: string) => Promise<void>;
    votePost: (postId: string) => Promise<void>;
    resolveQuestion: (postId: string, resolved?: boolean) => Promise<boolean>;
    acceptAnswer: (postId: string, commentId: string) => Promise<boolean>;
    deletePost: (postId: string) => Promise<void>;
    uploadMedia: (uri: string, type: 'image' | 'video') => Promise<string | null>;
    fetchPostComments: (postId: string) => Promise<void>;
    addComment: (postId: string, content: string, parentCommentId?: string | null) => Promise<boolean>;
    toggleCommentLike: (commentId: string, postId: string) => Promise<void>;
    deleteComment: (commentId: string, postId: string) => Promise<boolean>;
    fetchMentors: (groupId?: string) => Promise<void>;
    fetchMentorPosts: (params?: { groupId?: string | null; page?: number }) => Promise<void>;
    fetchMentorDetail: (userId: string) => Promise<void>;
    fetchMentorMe: () => Promise<void>;
    fetchMentorQuestions: (params?: { status?: MentorQuestionFilter; assigned?: boolean }) => Promise<void>;
    createMentorGroup: (payload: { name: string; description?: string; coverImage?: string | null }) => Promise<Group | null>;
    fetchMentorGroupMembers: (groupId: string) => Promise<void>;
    fetchMentorGroupCandidates: (groupId: string, query?: string) => Promise<void>;
    addMentorGroupMembers: (groupId: string, payload: { userIds?: string[]; groupIds?: string[] }) => Promise<boolean>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
    posts: [],
    groups: [],
    planGroups: [],
    mentorGroups: [],
    ownedGroups: [],
    mentorMemberGroups: [],
    generalGroup: null,
    currentGroup: null,
    comments: {},
    mentors: [],
    mentorDetail: null,
    mentorMe: { isMentor: false, profile: null },
    mentorQuestions: [],
    mentorPosts: [],
    mentorPostsLoading: false,
    mentorLoading: false,
    mentorError: null,
    mentorGroupMembers: [],
    mentorGroupCandidates: [],
    isLoading: false,
    error: null,
    communityAccessDenied: false,
    postingBlocked: false,

    fetchMyGroups: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get(`${API_URL}/community/my-groups`);

            if (response.data && response.data.success) {
                set({
                    groups: response.data?.groups || [],
                    planGroups: response.data?.planGroups || [],
                    mentorGroups: response.data?.mentorGroups || [],
                    ownedGroups: response.data?.ownedGroups || [],
                    mentorMemberGroups: response.data?.mentorMemberGroups || [],
                    generalGroup: response.data?.generalGroup || null,
                    isLoading: false,
                    communityAccessDenied: false,
                    postingBlocked: response.data?.postingBlocked === true,
                    error: null
                });
            } else {
                set({ groups: [], planGroups: [], mentorGroups: [], ownedGroups: [], mentorMemberGroups: [], generalGroup: null, isLoading: false, error: null });
            }
        } catch (error: any) {
            // Handle 403 - user doesn't have community access
            if (error.response?.status === 403) {
                set({ 
                    groups: [], 
                    planGroups: [],
                    mentorGroups: [],
                    ownedGroups: [],
                    mentorMemberGroups: [],
                    generalGroup: null,
                    isLoading: false, 
                    error: null,
                    communityAccessDenied: true 
                });
            } else {
                set({ groups: [], planGroups: [], mentorGroups: [], ownedGroups: [], mentorMemberGroups: [], generalGroup: null, isLoading: false, error: error?.message || 'Failed to load groups' });
            }
        }
    },

    fetchGroupPosts: async (groupId: string, page = 1, postType: FeedPostType = 'discussion', status: QuestionFilter = 'all') => {
        set({ isLoading: true, error: null });
        try {
            const params: Record<string, string | number> = { page, postType };
            if (postType === 'question' && status !== 'all') {
                if (status === 'mine') {
                    params.mine = 'true';
                } else {
                    params.status = status;
                }
            }
            const response = await apiClient.get(`${API_URL}/community/groups/${groupId}/posts`, {
                params
            });
            if (response.data?.success) {
                const newPosts = response.data?.posts ?? [];
                set(state => ({
                    posts: page === 1 ? newPosts : [...state.posts, ...newPosts],
                    isLoading: false
                }));
            } else {
                set({ isLoading: false, error: 'Failed to load posts' });
            }
        } catch (error: any) {
            let userMessage = 'Unable to load posts. Pull down to refresh.';
            if (!error.response) {
                userMessage = 'No internet connection. Posts will load when you\'re back online.';
            }

            set({ isLoading: false, error: userMessage });
        }
    },

    fetchAllPosts: async (page = 1, postType: FeedPostType = 'discussion', status: QuestionFilter = 'all') => {
        set({ isLoading: true, error: null });
        try {
            const params: Record<string, string | number> = { page, postType };
            if (postType === 'question' && status !== 'all') {
                if (status === 'mine') {
                    params.mine = 'true';
                } else {
                    params.status = status;
                }
            }
            const response = await apiClient.get(`${API_URL}/community/feed`, {
                params
            });
            if (response.data?.success) {
                const newPosts = response.data?.posts ?? [];
                set(state => ({
                    posts: page === 1 ? newPosts : [...state.posts, ...newPosts],
                    isLoading: false
                }));
            } else {
                set({ isLoading: false, error: 'Failed to load posts' });
            }
        } catch (error: any) {
            let userMessage = 'Unable to load posts. Pull down to refresh.';
            if (!error.response) {
                userMessage = 'No internet connection. Posts will load when you\'re back online.';
            }

            set({ isLoading: false, error: userMessage });
        }
    },

    uploadMedia: async (uri: string, type: 'image' | 'video') => {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'upload';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1] : type === 'image' ? 'jpg' : 'mp4';

        // React Native specific FormData append - field name must match backend multer config
        const fieldName = type === 'image' ? 'image' : 'video';
        formData.append(fieldName, {
            uri,
            name: `upload.${ext}`,
            type: type === 'image' ? `image/${ext}` : `video/${ext}`
        } as any);

        const endpoint = type === 'image' ? '/upload/image?folder=community' : '/upload/video?folder=community_videos';

        try {
            const headers: any = {
                'Content-Type': 'multipart/form-data',
            };

            const response = await apiClient.post(`${API_URL}${endpoint}`, formData, {
                headers,
                timeout: 30 * 60 * 1000,
                onUploadProgress: (progressEvent: any) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        console.log(`[uploadMedia] ${type} upload: ${percent}%`);
                    }
                }
            });

            if (response.data?.success) {
                return response.data?.data?.url;
            }
            return null;
        } catch (error: any) {
            return null;
        }
    },

    createPost: async (
        groupId: string,
        content: string,
        images?: string[],
        tags?: string[],
        options?: { postType?: FeedPostType; title?: string; assignedMentorId?: string | null }
    ) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(`${API_URL}/community/groups/${groupId}/posts`, {
                content,
                images,
                tags,
                postType: options?.postType || 'discussion',
                title: options?.title,
                assignedMentorId: options?.assignedMentorId || undefined,
            });

            if (response.data?.success) {
                const newPost = response.data?.post;
                // Optimistically add to top of feed
                set(state => ({
                    posts: [newPost, ...state.posts],
                    isLoading: false
                }));
                return true;
            }
            return false;
        } catch (error: any) {
            let userMessage = 'Unable to create post. Please try again.';
            if (!error.response) {
                userMessage = 'No internet connection. Please check your network.';
            } else if (error.response?.status === 401) {
                userMessage = 'Session expired. Please sign in again.';
            } else if (error.response?.status === 403 && error.response?.data?.code === 'POSTING_BLOCKED') {
                userMessage = error.response?.data?.message || 'You have been blocked from posting in the community.';
                set({ postingBlocked: true });
            }

            set({ isLoading: false, error: userMessage });
            return false;
        }
    },

    togglePostLike: async (postId: string) => {
        const toggle = (list: Post[]) => list.map(p => {
            if (p._id === postId) {
                return {
                    ...p,
                    userLiked: !p.userLiked,
                    likeCount: p.userLiked ? p.likeCount - 1 : p.likeCount + 1
                };
            }
            return p;
        });

        // Optimistic update
        set(state => ({
            posts: toggle(state.posts),
            mentorPosts: toggle(state.mentorPosts),
        }));

        try {
            await apiClient.post(`${API_URL}/community/posts/${postId}/like`);
            // Backend handles actual logic
        } catch (error) {
            // Revert changes on error
            set(state => ({
                posts: toggle(state.posts),
                mentorPosts: toggle(state.mentorPosts),
            }));
        }
    },

    votePost: async (postId: string) => {
        const previousPosts = get().posts;

        set(state => ({
            posts: state.posts.map(p => {
                if (p._id !== postId) return p;
                return {
                    ...p,
                    userVoted: !p.userVoted,
                    voteCount: Math.max(0, (p.voteCount || 0) + (p.userVoted ? -1 : 1)),
                };
            })
        }));

        try {
            const response = await apiClient.post(`${API_URL}/community/posts/${postId}/vote`);
            if (response.data?.success) {
                set(state => ({
                    posts: state.posts.map(p => p._id === postId
                        ? { ...p, userVoted: response.data.voted, voteCount: response.data.voteCount }
                        : p)
                }));
            }
        } catch (error) {
            set({ posts: previousPosts });
        }
    },

    resolveQuestion: async (postId: string, resolved = true) => {
        try {
            const response = await apiClient.patch(`${API_URL}/community/posts/${postId}/resolve`, { resolved });
            if (response.data?.success) {
                set(state => ({
                    posts: state.posts.map(p => p._id === postId
                        ? { ...p, isResolved: response.data.isResolved, acceptedCommentId: response.data.acceptedCommentId }
                        : p)
                }));
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    },

    acceptAnswer: async (postId: string, commentId: string) => {
        try {
            const response = await apiClient.patch(`${API_URL}/community/posts/${postId}/accept-answer`, { commentId });
            if (response.data?.success) {
                set(state => ({
                    posts: state.posts.map(p => p._id === postId
                        ? { ...p, isResolved: true, acceptedCommentId: response.data.acceptedCommentId }
                        : p),
                    comments: {
                        ...state.comments,
                        [postId]: (state.comments[postId] || []).map(c => ({
                            ...c,
                            isAccepted: c._id === commentId,
                        })),
                    },
                }));
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    },

    deletePost: async (postId: string) => {
        // Optimistic update
        const previousPosts = get().posts;
        const previousMentorPosts = get().mentorPosts;
        set(state => ({
            posts: state.posts.filter(p => p._id !== postId),
            mentorPosts: state.mentorPosts.filter(p => p._id !== postId)
        }));

        try {
            await apiClient.delete(`${API_URL}/community/posts/${postId}`);
        } catch (error) {
            // Revert
            set({ posts: previousPosts, mentorPosts: previousMentorPosts });
        }
    },

    fetchPostComments: async (postId: string) => {
        try {
            const response = await apiClient.get(`${API_URL}/community/posts/${postId}/comments`);
            if (response.data?.success) {
                set(state => ({
                    comments: {
                        ...state.comments,
                        [postId]: response.data?.comments
                    }
                }));
            }
        } catch (error) {
        }
    },

    addComment: async (postId: string, content: string, parentCommentId?: string | null) => {
        try {
            const response = await apiClient.post(`${API_URL}/community/posts/${postId}/comments`, {
                content,
                parentCommentId: parentCommentId || undefined,
            });

            if (response.data?.success) {
                // Add new comment to the list
                const newComment = response.data?.comment;
                set(state => ({
                    comments: {
                        ...state.comments,
                        [postId]: [...(state.comments[postId] || []), newComment]
                    },
                    // Update comment count on the post
                    posts: state.posts.map(p =>
                        p._id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
                    ),
                    mentorPosts: state.mentorPosts.map(p =>
                        p._id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
                    )
                }));
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    },

    toggleCommentLike: async (commentId: string, postId: string) => {
        // Snapshot current state for rollback
        const prevComments = useCommunityStore.getState().comments;

        // Optimistic update
        set(state => ({
            comments: {
                ...state.comments,
                [postId]: state.comments[postId]?.map(c => {
                    if (c._id === commentId) {
                        return {
                            ...c,
                            userLiked: !c.userLiked,
                            likeCount: c.userLiked ? c.likeCount - 1 : c.likeCount + 1
                        };
                    }
                    return c;
                }) || []
            }
        }));
        try {
            await apiClient.post(`${API_URL}/community/comments/${commentId}/like`);
        } catch (error) {
            // Revert on failure
            set({ comments: prevComments });
        }
    },

    deleteComment: async (commentId: string, postId: string) => {
        try {
            await apiClient.delete(`${API_URL}/community/comments/${commentId}`);
            set(state => ({
                comments: {
                    ...state.comments,
                    [postId]: (state.comments[postId] || []).filter(c => c._id !== commentId)
                },
                posts: state.posts.map(p =>
                    p._id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
                ),
                mentorPosts: state.mentorPosts.map(p =>
                    p._id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
                )
            }));
            return true;
        } catch (error) {
            return false;
        }
    },

    fetchMentors: async (groupId?: string) => {
        set({ mentorLoading: true, mentorError: null });
        try {
            const response = await apiClient.get(`${API_URL}/community/mentors`, {
                params: groupId ? { groupId } : undefined,
            });
            set({
                mentors: response.data?.mentors || [],
                mentorLoading: false,
            });
        } catch (error: any) {
            set({
                mentors: [],
                mentorLoading: false,
                mentorError: error.response?.data?.message || 'Failed to load mentors',
            });
        }
    },

    fetchMentorPosts: async ({ groupId = null, page = 1 } = {}) => {
        set({ mentorPostsLoading: true, mentorError: null });
        try {
            const endpoint = groupId
                ? `${API_URL}/community/groups/${groupId}/posts`
                : `${API_URL}/community/feed`;
            const response = await apiClient.get(endpoint, {
                params: { page, postType: 'mentor' },
            });
            const nextPosts = response.data?.posts || [];
            set(state => ({
                mentorPosts: page === 1 ? nextPosts : [...state.mentorPosts, ...nextPosts],
                mentorPostsLoading: false,
            }));
        } catch (error: any) {
            set({
                mentorPosts: page === 1 ? [] : get().mentorPosts,
                mentorPostsLoading: false,
                mentorError: error.response?.data?.message || 'Failed to load mentor posts',
            });
        }
    },

    createMentorGroup: async ({ name, description, coverImage }) => {
        try {
            const response = await apiClient.post(`${API_URL}/community/groups`, {
                name,
                description,
                coverImage,
            });
            const group = response.data?.group;
            if (!response.data?.success || !group) return null;

            const addGroup = (list: Group[]) => [
                group,
                ...list.filter((item) => item._id !== group._id),
            ];

            set(state => ({
                ownedGroups: addGroup(state.ownedGroups),
                mentorGroups: addGroup(state.mentorGroups),
                groups: addGroup(state.groups),
            }));

            return group as Group;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to create mentor group' });
            return null;
        }
    },

    fetchMentorGroupMembers: async (groupId: string) => {
        try {
            const response = await apiClient.get(`${API_URL}/community/groups/${groupId}/members`);
            set({
                mentorGroupMembers: response.data?.members || [],
            });
        } catch (error: any) {
            set({
                mentorGroupMembers: [],
                error: error.response?.data?.message || 'Failed to load group members',
            });
        }
    },

    fetchMentorGroupCandidates: async (groupId: string, query = '') => {
        try {
            const response = await apiClient.get(
                `${API_URL}/community/groups/${groupId}/member-candidates`,
                { params: query ? { q: query } : undefined }
            );
            set({ mentorGroupCandidates: response.data?.users || [] });
        } catch (error) {
            set({ mentorGroupCandidates: [] });
        }
    },

    addMentorGroupMembers: async (groupId, payload) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/community/groups/${groupId}/members`,
                payload
            );
            if (!response.data?.success) return false;

            await Promise.all([
                get().fetchMentorGroupMembers(groupId),
                get().fetchMyGroups(),
            ]);
            return true;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Failed to update group members' });
            return false;
        }
    },

    fetchMentorDetail: async (userId: string) => {
        set({ mentorLoading: true, mentorError: null, mentorDetail: null });
        try {
            const response = await apiClient.get(`${API_URL}/community/mentors/${userId}`);
            set({
                mentorDetail: response.data?.success ? response.data : null,
                mentorLoading: false,
            });
        } catch (error: any) {
            set({
                mentorDetail: null,
                mentorLoading: false,
                mentorError: error.response?.data?.message || 'Failed to load mentor profile',
            });
        }
    },

    fetchMentorMe: async () => {
        try {
            const response = await apiClient.get(`${API_URL}/community/mentor/me`);
            set({
                mentorMe: {
                    isMentor: response.data?.isMentor === true,
                    profile: response.data?.profile || null,
                },
            });
        } catch (error) {
            set({ mentorMe: { isMentor: false, profile: null } });
        }
    },

    fetchMentorQuestions: async ({ status = 'all', assigned = false } = {}) => {
        set({ mentorLoading: true, mentorError: null });
        try {
            const params: Record<string, string> = { status };
            if (assigned) params.assigned = 'true';

            const response = await apiClient.get(`${API_URL}/community/mentor/questions`, { params });
            set({
                mentorQuestions: response.data?.questions || [],
                mentorLoading: false,
            });
        } catch (error: any) {
            set({
                mentorQuestions: [],
                mentorLoading: false,
                mentorError: error.response?.status === 403
                    ? 'NOT_A_MENTOR'
                    : error.response?.data?.message || 'Failed to load mentor questions',
            });
        }
    },
}));
