import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    FlatList,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCommunityStore, Post } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '../hooks/useTheme';

interface CommentsModalProps {
    visible: boolean;
    postId: string | null;
    post?: Post | null;
    onClose: () => void;
}

export default function CommentsModal({ visible, postId, post, onClose }: CommentsModalProps) {
    const { colors } = useTheme();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
    const { user } = useAuthStore();

    const styles = useMemo(() => StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        sheet: {
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        closeButton: {
            position: 'absolute',
            right: 16,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        listContent: {
            padding: 16,
            paddingBottom: 80,
        },
        commentItem: {
            flexDirection: 'row',
            marginBottom: 20,
        },
        avatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 12,
            backgroundColor: colors.surfaceSecondary,
        },
        commentContent: {
            flex: 1,
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 4,
            alignItems: 'center',
        },
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        authorName: {
            fontWeight: '600',
            fontSize: 14,
            color: colors.text,
        },
        timeAgo: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        commentText: {
            fontSize: 14,
            color: colors.text,
            marginBottom: 6,
            lineHeight: 20,
        },
        actions: {
            flexDirection: 'row',
            gap: 16,
        },
        likeButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        likeCount: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        likedText: {
            color: colors.danger,
        },
        emptyState: {
            padding: 40,
            alignItems: 'center',
        },
        emptyText: {
            color: colors.textSecondary,
            fontStyle: 'italic',
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
        },
        inputAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 12,
            backgroundColor: colors.surfaceSecondary,
        },
        inputWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceSecondary,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        input: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            maxHeight: 100,
        },
        sendButton: {
            padding: 4,
            marginLeft: 8,
        },
    }), [colors]);

    const {
        comments,
        fetchPostComments,
        addComment,
        toggleCommentLike,
        deleteComment,
        acceptAnswer,
    } = useCommunityStore();

    const postComments = postId ? comments[postId] || [] : [];
    const [loadingComments, setLoadingComments] = useState(false);
    const activePostIdRef = useRef<string | null>(null);

    useEffect(() => {
        setReplyingTo(null);
        setContent('');
    }, [postId, visible]);

    useEffect(() => {
        const loadComments = async () => {
            if (!postId) return;
            activePostIdRef.current = postId;
            setLoadingComments(true);
            await fetchPostComments(postId);
            // Only update state if this is still the active post
            if (activePostIdRef.current === postId) {
                setLoadingComments(false);
            }
        };

        if (visible && postId) {
            loadComments();
        }
    }, [visible, postId, fetchPostComments]);

    const isQuestion = post?.postType === 'question';
    const canAccept = isQuestion && post?.viewerCanManageQuestion === true;

    const handleSend = async () => {
        if (!postId || !content.trim()) return;

        setIsSubmitting(true);
        const success = await addComment(postId, content, replyingTo?.id || null);
        if (success) {
            setContent('');
            setReplyingTo(null);
            Keyboard.dismiss();
        } else {
            Alert.alert('Error', 'Failed to post comment. Please try again.');
        }
        setIsSubmitting(false);
    };

    const handleAccept = async (commentId: string) => {
        if (!postId) return;
        const success = await acceptAnswer(postId, commentId);
        if (!success) {
            Alert.alert('Error', 'Failed to accept this answer. Please try again.');
        }
    };

    const handleCommentDelete = (commentId: string) => {
        if (!postId) return;
        Alert.alert('Delete Comment', 'Delete this comment?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteComment(commentId, postId);
                }
            },
        ]);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <SafeAreaView style={styles.sheet} edges={['bottom']}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{isQuestion ? 'Answers' : 'Comments'}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {loadingComments && postComments.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={postComments}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => (
                                <View style={[styles.commentItem, item.parentCommentId ? { marginLeft: 40 } : null]}>
                                    <Image
                                        source={{ uri: item.author?.photoURL || 'https://via.placeholder.com/40' }}
                                        style={styles.avatar}
                                    />
                                    <View style={styles.commentContent}>
                                        <View style={styles.commentHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                <Text style={styles.authorName}>{item.author?.displayName || 'User'}</Text>
                                                {item.author?.isMentor && (
                                                    <View style={{ backgroundColor: 'rgba(241,132,45,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#F1842D' }}>Mentor</Text>
                                                    </View>
                                                )}
                                                {item.isAccepted && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8F5E9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                                                        <Ionicons name="checkmark-circle" size={11} color="#2E7D32" />
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2E7D32' }}>Accepted</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.headerRight}>
                                                <Text style={styles.timeAgo}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                                                {item.author?._id && user?._id && item.author._id === user._id && (
                                                    <TouchableOpacity
                                                        onPress={() => handleCommentDelete(item._id)}
                                                        style={{ marginLeft: 10 }}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Ionicons name="trash-outline" size={15} color={colors.textSecondary} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={styles.commentText}>{item.content}</Text>

                                        <View style={styles.actions}>
                                            <TouchableOpacity
                                                style={styles.likeButton}
                                                onPress={() => postId && toggleCommentLike(item._id, postId)}
                                            >
                                                <Ionicons
                                                    name={item.userLiked ? "heart" : "heart-outline"}
                                                    size={16}
                                                    color={item.userLiked ? colors.danger : colors.textSecondary}
                                                />
                                                <Text style={[styles.likeCount, item.userLiked && styles.likedText]}>
                                                    {item.likeCount > 0 ? item.likeCount : ''}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setReplyingTo({ id: item._id, name: item.author?.displayName || 'comment' })}
                                            >
                                                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Reply</Text>
                                            </TouchableOpacity>
                                            {canAccept && !item.isAccepted && (
                                                <TouchableOpacity onPress={() => handleAccept(item._id)}>
                                                    <Text style={{ fontSize: 12, color: '#2E7D32', fontWeight: '700' }}>Accept answer</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
                                </View>
                            }
                        />
                    )}

                    {replyingTo && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surfaceSecondary }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                                Replying to {replyingTo.name}
                            </Text>
                            <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Image
                            source={{ uri: user?.photoURL || 'https://via.placeholder.com/40' }}
                            style={styles.inputAvatar}
                        />
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : (isQuestion ? 'Write an answer...' : 'Add a comment...')}
                                placeholderTextColor={colors.textSecondary}
                                value={content}
                                onChangeText={setContent}
                                multiline
                                maxLength={500}
                            />
                            {content.trim().length > 0 && (
                                <TouchableOpacity
                                    style={styles.sendButton}
                                    onPress={handleSend}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Ionicons name="send" size={20} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </Modal>
    );
}
