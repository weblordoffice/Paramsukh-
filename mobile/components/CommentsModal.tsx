import React, { useState, useEffect } from 'react';
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
    Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';

interface CommentsModalProps {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
}

export default function CommentsModal({ visible, postId, onClose }: CommentsModalProps) {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuthStore();

    const {
        comments,
        fetchPostComments,
        addComment,
        toggleCommentLike
    } = useCommunityStore();

    const postComments = postId ? comments[postId] || [] : [];
    const [loadingComments, setLoadingComments] = useState(false);

    useEffect(() => {
        const loadComments = async () => {
            if (!postId) return;
            setLoadingComments(true);
            await fetchPostComments(postId);
            setLoadingComments(false);
        };

        if (visible && postId) {
            loadComments();
        }
    }, [visible, postId, fetchPostComments]);

    const handleSend = async () => {
        if (!postId || !content.trim()) return;

        setIsSubmitting(true);
        const success = await addComment(postId, content);
        if (success) {
            setContent('');
            Keyboard.dismiss();
        }
        setIsSubmitting(false);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Comments</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#111827" />
                    </TouchableOpacity>
                </View>

                {loadingComments && postComments.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#F1842D" />
                    </View>
                ) : (
                    <FlatList
                        data={postComments}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={styles.commentItem}>
                                <Image
                                    source={{ uri: item.author.photoURL || 'https://via.placeholder.com/40' }}
                                    style={styles.avatar}
                                />
                                <View style={styles.commentContent}>
                                    <View style={styles.commentHeader}>
                                        <Text style={styles.authorName}>{item.author.displayName || 'User'}</Text>
                                        <Text style={styles.timeAgo}>{new Date(item.createdAt).toLocaleDateString()}</Text>
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
                                                color={item.userLiked ? "#EF4444" : "#6B7280"}
                                            />
                                            <Text style={[styles.likeCount, item.userLiked && styles.likedText]}>
                                                {item.likeCount > 0 ? item.likeCount : ''}
                                            </Text>
                                        </TouchableOpacity>
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

                <View style={styles.inputContainer}>
                    <Image
                        source={{ uri: user?.photoURL || 'https://via.placeholder.com/40' }}
                        style={styles.inputAvatar}
                    />
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment..."
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
                                    <ActivityIndicator size="small" color="#F1842D" />
                                ) : (
                                    <Ionicons name="send" size={20} color="#F1842D" />
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
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
        backgroundColor: '#F3F4F6',
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
    authorName: {
        fontWeight: '600',
        fontSize: 14,
        color: '#1F2937',
    },
    timeAgo: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    commentText: {
        fontSize: 14,
        color: '#4B5563',
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
        color: '#6B7280',
    },
    likedText: {
        color: '#EF4444',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    },
    inputAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
        backgroundColor: '#F3F4F6',
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#1F2937',
        maxHeight: 100,
    },
    sendButton: {
        padding: 4,
        marginLeft: 8,
    },
});
