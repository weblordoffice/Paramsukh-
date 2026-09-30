import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface CertificateData {
  certificateId: string;
  issuedTo: string;
  courseName: string;
  issuedAt: string;
}

interface CertificateViewerModalProps {
  visible: boolean;
  onClose: () => void;
  certificate: CertificateData | null;
}

export default function CertificateViewerModal({
  visible,
  onClose,
  certificate
}: CertificateViewerModalProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    container: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 10
    },
    frame: {
      width: '100%',
      borderWidth: 6,
      borderColor: colors.warning,
      borderRadius: 12,
      padding: 3,
      backgroundColor: colors.surfaceSecondary
    },
    innerFrame: {
      borderWidth: 2,
      borderColor: colors.warning,
      borderRadius: 8,
      padding: 20,
      alignItems: 'center',
      borderStyle: 'dashed'
    },
    sealWrapper: {
      marginBottom: 10
    },
    title: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#8B5CF6',
      letterSpacing: 2,
      textAlign: 'center'
    },
    subtitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginTop: 5,
      textAlign: 'center'
    },
    divider: {
      width: 60,
      height: 2,
      backgroundColor: colors.warning,
      marginVertical: 15
    },
    presentText: {
      fontSize: 12,
      fontStyle: 'italic',
      color: colors.textSecondary,
      marginBottom: 8
    },
    recipientName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 15
    },
    bodyText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 10
    },
    courseName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.warning,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 5
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 10
    },
    footerItem: {
      alignItems: 'center',
      flex: 1
    },
    footerLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2
    },
    footerValue: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center'
    },
    actions: {
      width: '100%',
      marginTop: 20,
      gap: 10
    },
    shareBtn: {
      backgroundColor: '#3B82F6',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4
    },
    shareText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      marginLeft: 8,
      fontSize: 16
    },
    closeBtn: {
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12
    },
    closeText: {
      color: colors.text,
      fontWeight: 'bold',
      fontSize: 16
    }
  }), [colors]);

  if (!certificate) return null;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I successfully completed "${certificate.courseName}" on ParamSukh Gurukul! Verifiable Certificate ID: ${certificate.certificateId}`
      });
    } catch (error) {
      console.error('Error sharing certificate:', error);
    }
  };

  const formattedDate = new Date(certificate.issuedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* Certificate Frame */}
          <View style={styles.frame}>
            <View style={styles.innerFrame}>

              {/* Seal Icon */}
              <View style={styles.sealWrapper}>
                <Ionicons name="ribbon-sharp" size={48} color={colors.warning} />
              </View>

              {/* Title Header */}
              <Text style={styles.title}>PARAMSUKH GURUKUL</Text>
              <Text style={styles.subtitle}>Certificate of Completion</Text>

              <View style={styles.divider} />

              <Text style={styles.presentText}>This is proudly presented to</Text>
              <Text style={styles.recipientName}>{certificate.issuedTo || 'Gurukul Disciple'}</Text>

              <Text style={styles.bodyText}>
                for successfully completing the online wellness curriculum:
              </Text>
              <Text style={styles.courseName}>{certificate.courseName}</Text>

              <View style={styles.divider} />

              {/* Footer details */}
              <View style={styles.footer}>
                <View style={styles.footerItem}>
                  <Text style={styles.footerLabel}>Date Issued</Text>
                  <Text style={styles.footerValue}>{formattedDate}</Text>
                </View>
                <View style={styles.footerItem}>
                  <Text style={styles.footerLabel}>Certificate ID</Text>
                  <Text style={styles.footerValue}>{certificate.certificateId}</Text>
                </View>
              </View>

            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
              <Text style={styles.shareText}>Share Achievement</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}
