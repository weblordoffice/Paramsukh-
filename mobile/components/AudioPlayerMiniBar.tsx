import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayerStore } from '../store/audioPlayerStore';
import { useTheme } from '../hooks/useTheme';

function formatTime(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayerMiniBar() {
    const { colors } = useTheme();
    const {
        currentTrack,
        isPlaying,
        isBuffering,
        playbackPosition,
        playbackDuration,
        togglePlayPause,
        stop,
    } = useAudioPlayerStore();

    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        progressBar: {
            height: 3,
            backgroundColor: colors.surfaceSecondary,
        },
        progressFill: {
            height: '100%',
            backgroundColor: '#3B82F6',
        },
        content: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        thumbnail: {
            width: 44,
            height: 44,
            borderRadius: 8,
            backgroundColor: colors.surfaceSecondary,
        },
        thumbnailPlaceholder: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        info: {
            flex: 1,
            marginLeft: 12,
            marginRight: 8,
        },
        title: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
        },
        host: {
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: 2,
        },
        controlBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
    }), [colors]);

    if (!currentTrack) return null;

    return (
        <View style={styles.container}>
            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: playbackDuration > 0
                                ? `${(playbackPosition / playbackDuration) * 100}%`
                                : '0%',
                        },
                    ]}
                />
            </View>

            <View style={styles.content}>
                <Image
                    source={
                        currentTrack.thumbnailUrl && currentTrack.thumbnailUrl.startsWith('http')
                            ? { uri: currentTrack.thumbnailUrl }
                            : undefined
                    }
                    style={styles.thumbnail}
                />
                {!currentTrack.thumbnailUrl?.startsWith('http') ? (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                        <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
                    </View>
                ) : null}

                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
                    <Text style={styles.host} numberOfLines={1}>
                        {currentTrack.host} • {formatTime(playbackPosition)} / {formatTime(playbackDuration)}
                    </Text>
                </View>

                <TouchableOpacity style={styles.controlBtn} onPress={togglePlayPause}>
                    <Ionicons
                        name={isBuffering ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeBtn} onPress={stop}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
