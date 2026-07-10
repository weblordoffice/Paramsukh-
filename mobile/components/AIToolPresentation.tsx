import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, StyleSheet, Text, View, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAddressStore } from '../store/addressStore';

import type { AIToolPresentation as AIToolPresentationType, AIToolPresentationSection } from '../store/aiAssistantStore';

type Props = {
  presentation: AIToolPresentationType;
  onActionPress?: (section: AIToolPresentationSection) => void | Promise<void>;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatLabel = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatPreviewText = (value?: string | null, maxLength = 180) => {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const renderDetailCard = (
  key: string,
  icon: keyof typeof Ionicons.glyphMap,
  value?: string | null,
  options?: { wide?: boolean }
) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  return (
    <View key={key} style={[styles.detailCard, options?.wide && styles.detailCardWide]}>
      <View style={styles.detailCardIconWrap}>
        <Ionicons name={icon} size={13} color="#C26D1D" />
      </View>
      <Text style={styles.detailCardText}>{text}</Text>
    </View>
  );
};

const renderMetaTagCard = (key: string, value?: string | null, tone: 'accent' | 'neutral' = 'neutral') => {
  const text = formatLabel(value);
  if (!text) {
    return null;
  }

  return (
    <View key={key} style={[styles.metaTagCard, tone === 'accent' ? styles.metaTagCardAccent : styles.metaTagCardNeutral]}>
      <Text style={[styles.metaTagCardText, tone === 'accent' ? styles.metaTagCardTextAccent : styles.metaTagCardTextNeutral]}>
        {text}
      </Text>
    </View>
  );
};

const renderRows = (rows?: { label: string; value: string }[]) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return (
    <View style={styles.rowStack}>
      {rows.map((row) => (
        <View key={`${row.label}-${row.value}`} style={styles.rowLine}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
};

const renderCommunityActionPreview = (section: AIToolPresentationSection) => {
  const metadata = section.metadata || {};
  const actionKind = String(metadata.communityActionKind || '').trim();
  if (!actionKind) {
    return null;
  }

  const contentPreview = formatPreviewText(metadata.contentPreview, 220);
  const targetPreview = formatPreviewText(metadata.targetPreview, 160);
  const targetAuthor = String(metadata.targetAuthor || '').trim();
  const communityName = String(metadata.communityName || '').trim();
  const tagsLabel = String(metadata.tagsLabel || '').trim();

  if (!contentPreview && !targetPreview && !communityName && !tagsLabel) {
    return null;
  }

  const targetLabel =
    actionKind === 'comment_reply'
      ? targetAuthor
        ? `Replying to ${targetAuthor}`
        : 'Replying to comment'
      : actionKind === 'post_reply'
        ? 'Replying on post'
        : 'Community';

  const contentLabel =
    actionKind === 'community_post'
      ? 'Published post'
      : actionKind === 'comment_reply'
        ? 'Your threaded reply'
        : 'Your reply';

  return (
    <View style={styles.communityActionPreviewWrap}>
      {targetPreview ? (
        <View style={styles.communityActionTargetCard}>
          <View style={styles.communityActionTargetHeader}>
            <View style={styles.communityActionTargetIconWrap}>
              <Ionicons
                name={actionKind === 'comment_reply' ? 'return-up-forward-outline' : 'chatbubble-ellipses-outline'}
                size={12}
                color="#B85C14"
              />
            </View>
            <Text style={styles.communityActionTargetLabel}>{targetLabel}</Text>
          </View>
          <View style={styles.communityActionQuoteCard}>
            <Text style={styles.communityActionQuoteMark}>&quot;</Text>
            <Text style={styles.communityActionTargetText} numberOfLines={4}>
              {targetPreview}
            </Text>
          </View>
        </View>
      ) : null}

      {contentPreview ? (
        <View style={styles.communityActionContentCard}>
          <Text style={styles.communityActionContentLabel}>{contentLabel}</Text>
          <Text style={styles.communityActionContentText}>{contentPreview}</Text>
        </View>
      ) : null}

      {(communityName || tagsLabel) ? (
        <View style={styles.communityActionMetaRow}>
          {communityName ? (
            <View style={styles.communityActionMetaCard}>
              <Ionicons name="people-outline" size={12} color="#B85C14" />
              <Text style={styles.communityActionMetaText} numberOfLines={1}>
                {communityName}
              </Text>
            </View>
          ) : null}
          {tagsLabel ? (
            <View style={styles.communityActionMetaCard}>
              <Ionicons name="pricetags-outline" size={12} color="#B85C14" />
              <Text style={styles.communityActionMetaText} numberOfLines={1}>
                {tagsLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const renderComparisonMetric = (label: string, value?: string | null, options?: { accent?: boolean }) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  return (
    <View key={`${label}-${text}`} style={[styles.comparisonMetricCard, options?.accent && styles.comparisonMetricCardAccent]}>
      <Text style={styles.comparisonMetricLabel}>{label}</Text>
      <Text style={[styles.comparisonMetricValue, options?.accent && styles.comparisonMetricValueAccent]}>{text}</Text>
    </View>
  );
};

const getCategoryBg = (category?: string) => {
  const cat = String(category || '').trim().toLowerCase();
  const map: Record<string, string> = {
    physical: '#EF4444',
    mental: '#8B5CF6',
    financial: '#22C55E',
    relationship: '#EC4899',
    spiritual: '#F59E0B',
    general: '#64748B',
  };
  return map[cat] || '#64748B';
};

const getCategoryIcon = (category?: string) => {
  const cat = String(category || '').trim().toLowerCase();
  const map: Record<string, string> = {
    physical: 'barbell',
    mental: 'brain',
    financial: 'cash',
    relationship: 'heart',
    spiritual: 'sparkles',
    general: 'layers',
  };
  return map[cat] || 'layers';
};

const renderListItem = (
  section: AIToolPresentationSection,
  item: any,
  onActionPress?: (section: AIToolPresentationSection) => void | Promise<void>,
) => {
  switch (section.kind) {
    case 'course_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={styles.courseCard}>
          {/* Top Banner Image */}
          <View style={styles.courseImageContainer}>
            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.courseBannerImage} resizeMode="cover" />
            ) : (
              <View style={[styles.courseBannerPlaceholder, { backgroundColor: item.color || '#F1842D' }]}>
                <Ionicons name="book" size={32} color="#FFFFFF" />
              </View>
            )}

            {/* Category Badge on top of Image */}
            {item.category ? (
              <View style={[styles.courseCategoryOverlay, { backgroundColor: getCategoryBg(item.category) }]}>
                <Ionicons name={getCategoryIcon(item.category) as any} size={11} color="#FFFFFF" />
                <Text style={styles.courseCategoryOverlayText}>
                  {String(item.category).toUpperCase()}
                </Text>
              </View>
            ) : null}

            {/* Access Status Overlay (if locked) */}
            {item.accessLabel === 'Upgrade needed' ? (
              <View style={styles.courseLockOverlay}>
                <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
              </View>
            ) : null}
          </View>

          {/* Card Body */}
          <View style={styles.courseCardBody}>
            {/* Title & Description */}
            <Text style={styles.courseCardTitle} numberOfLines={2}>{item.title}</Text>
            {!!item.description && (
              <Text style={styles.courseCardDescription} numberOfLines={3}>
                {item.description}
              </Text>
            )}

            {/* Plan Badges (Membership restrictions) */}
            {Array.isArray(item.includedInPlans) && item.includedInPlans.length > 0 ? (
              <View style={styles.coursePlanBadgeRow}>
                {item.includedInPlans.map((plan: string) => (
                  <View key={`${item.id}-${plan}`} style={styles.coursePlanBadge}>
                    <Text style={styles.coursePlanBadgeText}>{plan.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Divider line for clean layout */}
            <View style={styles.courseDivider} />

            {/* Stats Grid */}
            <View style={styles.courseStatsGrid}>
              {renderDetailCard(`${item.id}-duration`, 'time-outline', item.duration)}
              {renderDetailCard(`${item.id}-rating`, 'star-outline', item.ratingLabel)}
              {renderDetailCard(`${item.id}-videos`, 'play-circle-outline', item.videoCountLabel)}
              {renderDetailCard(`${item.id}-pdfs`, 'document-text-outline', item.pdfCountLabel)}
              {typeof item.progress === 'number'
                ? renderDetailCard(`${item.id}-progress`, 'trending-up-outline', `${item.progress}% progress`)
                : null}
              {renderDetailCard(`${item.id}-last-active`, 'flash-outline', item.lastAccessedLabel)}
              {renderDetailCard(`${item.id}-completed`, 'checkmark-done-outline', item.completionLabel)}
            </View>

            {/* Access/Enrollment message if any */}
            {!!item.accessMessage && (
              <View style={styles.courseAccessAlert}>
                <Ionicons name="information-circle-outline" size={14} color="#9A6B44" />
                <Text style={styles.courseAccessAlertText}>{item.accessMessage}</Text>
              </View>
            )}
          </View>
        </View>
      );
    case 'event_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={[styles.listCard, styles.featureListCard]}>
          <View style={styles.listHeaderRow}>
            <View style={styles.listTitleWrap}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.eventBadgeRow}>
                {renderMetaTagCard(`${item.id}-category`, item.category, 'accent')}
                {renderMetaTagCard(`${item.id}-location-type`, item.locationType)}
                {renderMetaTagCard(`${item.id}-status`, item.status)}
              </View>
            </View>
            <Text style={[styles.statusPill, item.isPaid ? styles.statusPillOrange : styles.statusPillNeutral]}>
              {item.priceLabel}
            </Text>
          </View>
          {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
          <View style={styles.detailGrid}>
            {renderDetailCard(`${item.id}-date`, 'calendar-outline', formatDate(item.date))}
            {renderDetailCard(`${item.id}-time`, 'time-outline', item.time)}
            {renderDetailCard(`${item.id}-location`, 'location-outline', item.location, { wide: true })}
          </View>
        </View>
      );
    case 'registration_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={[styles.listCard, styles.featureListCard]}>
          <View style={styles.listHeaderRow}>
            <View style={styles.listTitleWrap}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <View style={styles.badgeRow}>
                {item.paymentStatus ? <Text style={styles.badgeMuted}>{formatLabel(item.paymentStatus)}</Text> : null}
                {item.priceLabel ? <Text style={styles.badge}>{item.priceLabel}</Text> : null}
              </View>
            </View>
            {item.status ? (
              <Text style={[styles.statusPill, item.status === 'confirmed' ? styles.statusPillGreen : styles.statusPillNeutral]}>
                {formatLabel(item.status)}
              </Text>
            ) : null}
          </View>
          <View style={styles.detailGrid}>
            {renderDetailCard(`${item.id}-date`, 'calendar-outline', formatDate(item.date))}
            {renderDetailCard(`${item.id}-time`, 'time-outline', item.time)}
            {renderDetailCard(`${item.id}-location`, 'location-outline', item.location, { wide: true })}
          </View>
        </View>
      );
    case 'membership_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={styles.listCard}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={[styles.statusPill, styles.statusPillOrange]}>{item.priceLabel}</Text>
          </View>
          {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
          <View style={styles.badgeRow}>
            {item.validityDays ? <Text style={styles.badge}>{item.validityDays} days</Text> : null}
            {Array.isArray(item.benefits)
              ? item.benefits.map((benefit: string) => (
                  <Text key={`${item.id}-${benefit}`} style={styles.badgeMuted}>
                    {benefit}
                  </Text>
                ))
              : null}
          </View>
        </View>
      );
    case 'podcast_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={styles.listCard}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.duration ? <Text style={styles.trailingMeta}>{item.duration}</Text> : null}
          </View>
          {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
          <View style={styles.badgeRow}>
            {item.host ? <Text style={styles.badge}>{item.host}</Text> : null}
            {item.category ? <Text style={styles.badgeMuted}>{item.category}</Text> : null}
            {item.accessType ? <Text style={styles.badgeMuted}>{item.accessType}</Text> : null}
          </View>
        </View>
      );
    case 'support_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={styles.listCard}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.status ? <Text style={[styles.statusPill, styles.statusPillNeutral]}>{item.status}</Text> : null}
          </View>
          {!!item.content && <Text style={styles.itemDescription}>{item.content}</Text>}
          <View style={styles.badgeRow}>
            {item.type ? <Text style={styles.badge}>{item.type}</Text> : null}
            {formatDate(item.updatedAt) ? <Text style={styles.badgeMuted}>{formatDate(item.updatedAt)}</Text> : null}
          </View>
        </View>
      );
    case 'counseling_list':
      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={[styles.listCard, styles.featureListCard]}>
          <View style={styles.listHeaderRow}>
            <View
              style={[
                styles.sectionIconWrap,
                {
                  backgroundColor: item.bgColor || '#EFF6FF',
                  borderColor: item.color || '#3B82F6',
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                },
              ]}
            >
              <Ionicons name={(item.icon || 'help-buoy') as any} size={14} color={item.color || '#3B82F6'} />
            </View>
            <View style={[styles.listTitleWrap, { marginLeft: 8 }]}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.subtitle || 'Expert Counselor'}
              </Text>
            </View>
            <Text style={[styles.statusPill, item.isFree ? styles.statusPillGreen : styles.statusPillOrange]}>
              {item.priceLabel}
            </Text>
          </View>
          {!!item.description && (
            <Text style={styles.itemDescription} numberOfLines={3}>
              {item.description}
            </Text>
          )}
          <View style={styles.detailGrid}>
            {renderDetailCard(`${item.id}-duration`, 'time-outline', item.duration)}
            {renderDetailCard(`${item.id}-type`, 'bookmark-outline', item.type)}
          </View>
        </View>
      );
    case 'product_list': {
      const handleBuyPress = () => {
        if (onActionPress) {
          void onActionPress({
            kind: 'action_status',
            title: `Buy ${item.title}`,
            ctaType: 'order_product',
            ctaLabel: 'Place Order',
            rows: [
              { label: 'Product Name', value: item.title },
              { label: 'Price', value: item.priceLabel },
            ],
            metadata: {
              productId: item.id,
              quantity: 1,
            },
          } as any);
        }
      };

      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={[styles.listCard, styles.featureListCard]}>
          <View style={styles.listHeaderRow}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.productThumbnail} resizeMode="cover" />
            ) : (
              <View style={styles.productThumbnailPlaceholder}>
                <Ionicons name="basket-outline" size={20} color="#9A6B44" />
              </View>
            )}
            <View style={[styles.listTitleWrap, { marginLeft: 10 }]}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.shopName || 'ParamSukh Shop'}
              </Text>
              <View style={styles.eventBadgeRow}>
                {renderMetaTagCard(`${item.id}-category`, item.category, 'accent')}
                {item.isOutOfStock ? (
                  <Text style={[styles.statusPill, styles.statusPillRed, { fontSize: 9, paddingVertical: 1 }]}>
                    Out of Stock
                  </Text>
                ) : (
                  <Text style={[styles.statusPill, styles.statusPillGreen, { fontSize: 9, paddingVertical: 1 }]}>
                    In Stock
                  </Text>
                )}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text style={styles.productPriceText}>{item.priceLabel}</Text>
              {item.mrpLabel ? (
                <Text style={styles.productMrpText}>{item.mrpLabel}</Text>
              ) : null}
            </View>
          </View>
          {!!item.description && (
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={[styles.detailGrid, { alignItems: 'center', justifyContent: 'space-between' }]}>
            {renderDetailCard(`${item.id}-rating`, 'star-outline', item.ratingLabel)}
            {!item.isOutOfStock && onActionPress ? (
              <Pressable style={styles.buyNowMiniButton} onPress={handleBuyPress}>
                <Ionicons name="cart-outline" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.buyNowMiniButtonText}>Buy Now</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    }
    case 'address_list': {
      const handleSelectAddress = () => {
        if (onActionPress) {
          void onActionPress({
            kind: 'action_status',
            title: `Deliver to ${item.title}`,
            ctaType: 'select_address',
            ctaLabel: 'Select Address',
            metadata: {
              addressId: item.id,
              fullName: item.title,
            },
          } as any);
        }
      };

      const getAddrIcon = () => {
        switch (item.type) {
          case 'home':
            return { name: 'home-outline', color: '#10B981', bg: '#E6F4EA', border: '#A7F3D0' };
          case 'work':
            return { name: 'briefcase-outline', color: '#3B82F6', bg: '#EBF5FF', border: '#BFDBFE' };
          default:
            return { name: 'location-outline', color: '#F1842D', bg: '#FFF6EC', border: '#F6DEC5' };
        }
      };

      const iconStyle = getAddrIcon();

      return (
        <Pressable
          key={`${section.kind}-${item.id || item.title}`}
          style={({ pressed }) => [
            styles.listCard,
            styles.featureListCard,
            pressed && { opacity: 0.85, backgroundColor: '#FAFAFA' }
          ]}
          onPress={handleSelectAddress}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View
              style={[
                styles.sectionIconWrap,
                {
                  backgroundColor: iconStyle.bg,
                  borderColor: iconStyle.border,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons name={iconStyle.name as any} size={16} color={iconStyle.color} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.itemTitle, { fontSize: 13 }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={[styles.statusPill, { fontSize: 8, paddingVertical: 1, backgroundColor: iconStyle.bg, color: iconStyle.color, borderWidth: 0 }]}>
                    {item.type.toUpperCase()}
                  </Text>
                  {item.isDefault ? (
                    <Text style={[styles.statusPill, styles.statusPillGreen, { fontSize: 8, paddingVertical: 1 }]}>
                      DEFAULT
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.itemDescription, { fontSize: 11, lineHeight: 16 }]} numberOfLines={3}>
                {item.description}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                {renderDetailCard(`${item.id}-phone`, 'call-outline', item.phone)}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#F1842D' }}>Deliver Here</Text>
                  <Ionicons name="arrow-forward-outline" size={11} color="#F1842D" />
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      );
    }
    case 'order_list': {
      const handleCancelPress = () => {
        if (onActionPress) {
          void onActionPress({
            kind: 'action_status',
            title: `Cancel ${item.title}`,
            ctaType: 'cancel_order',
            ctaLabel: 'Cancel Order',
            metadata: {
              orderId: item.id,
              orderNumber: item.title.replace('Order #', '').trim(),
            },
          } as any);
        }
      };

      const isCancellable = item.status === 'pending' || item.status === 'confirmed';

      const getStatusDetails = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'delivered') {
          return { bg: '#E6F4EA', color: '#137333', icon: 'checkmark-circle-outline' as const };
        }
        if (s === 'cancelled' || s === 'returned') {
          return { bg: '#FCE8E6', color: '#C5221F', icon: 'close-circle-outline' as const };
        }
        if (s === 'shipped' || s === 'out_for_delivery') {
          return { bg: '#E8F0FE', color: '#1A73E8', icon: 'bicycle-outline' as const };
        }
        return { bg: '#FFF4E8', color: '#B85C14', icon: 'time-outline' as const };
      };

      const statusConf = getStatusDetails(item.status);

      return (
        <View key={`${section.kind}-${item.id || item.title}`} style={[styles.listCard, styles.featureListCard, { padding: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.itemTitle, { fontSize: 14, fontWeight: '800' }]}>{item.title}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>
                Placed on {formatDate(item.date)}
              </Text>
            </View>
            <Text style={[styles.productPriceText, { fontSize: 15, fontWeight: '900' }]}>{item.priceLabel}</Text>
          </View>

          <View style={{ height: 1, backgroundColor: '#F0ECE6', marginVertical: 8 }} />

          <Text style={[styles.itemDescription, { color: '#4B5563', lineHeight: 18 }]} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: statusConf.bg,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                gap: 4,
              }}>
                <Ionicons name={statusConf.icon} size={12} color={statusConf.color} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: statusConf.color, textTransform: 'uppercase' }}>
                  {item.status}
                </Text>
              </View>

              <Text style={[styles.badgeMuted, { textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.3 }]}>
                {item.paymentStatus}
              </Text>
            </View>

            {isCancellable && onActionPress ? (
              <Pressable
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: pressed ? '#FEE2E2' : '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FCA5A5',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    gap: 4,
                  }
                ]}
                onPress={handleCancelPress}
              >
                <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '800' }}>Cancel Order</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    }
    case 'group_list': {
      const handleSelectGroup = (groupId: string, name: string) => {
        if (onActionPress) {
          void onActionPress({
            kind: 'action_status',
            title: `View Posts in ${name}`,
            ctaType: 'view_posts',
            ctaLabel: 'View Feed',
            metadata: {
              groupId,
              groupName: name,
            },
          } as any);
        }
      };

      const renderGroupRow = (group: any, isSubgroup = false) => {
        return (
          <Pressable
            key={group.id}
            style={({ pressed }) => [
              styles.listCard,
              isSubgroup ? { marginLeft: 16, borderColor: '#F0ECE6', backgroundColor: '#FAF8F5' } : styles.featureListCard,
              pressed && { opacity: 0.85, backgroundColor: '#FAFAFA' }
            ]}
            onPress={() => handleSelectGroup(group.id, group.title)}
          >
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[
                styles.sectionIconWrap,
                {
                  backgroundColor: isSubgroup ? '#FFF4E8' : '#FFE9D2',
                  borderColor: isSubgroup ? '#F2CDA5' : '#EADBCB',
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                }
              ]}>
                <Ionicons
                  name={group.groupType === 'plan' ? 'people-outline' : group.groupType === 'category' ? 'layers-outline' : 'library-outline'}
                  size={16}
                  color="#A85D18"
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.itemTitle, { fontSize: 13, fontWeight: '700' }]}>{group.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="people-outline" size={11} color="#9CA3AF" />
                    <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '700' }}>
                      {group.memberCount}
                    </Text>
                  </View>
                </View>
                {group.description ? (
                  <Text style={[styles.itemDescription, { fontSize: 11 }]} numberOfLines={2}>
                    {group.description}
                  </Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      };

      const hasSubgroups = Array.isArray(item.subgroups) && item.subgroups.length > 0;

      return (
        <View key={item.id} style={{ gap: 8 }}>
          {renderGroupRow(item, false)}
          {hasSubgroups ? (
            <View style={{ gap: 6, paddingLeft: 8 }}>
              {item.subgroups.map((sub: any) => renderGroupRow(sub, true))}
            </View>
          ) : null}
        </View>
      );
    }
    case 'post_list': {
      const handleLikePress = (postId: string) => {
        if (onActionPress) {
          void onActionPress({
            kind: 'action_status',
            title: 'Liking Post',
            ctaType: 'like_post',
            ctaLabel: 'Like',
            metadata: { postId },
          } as any);
        }
      };

      const handleCommentsPress = (postId: string) => {
        if (onActionPress) {
          void onActionPress({
            kind: 'action_status',
            title: 'Viewing Comments',
            ctaType: 'view_comments',
            ctaLabel: 'Comments',
            metadata: { postId },
          } as any);
        }
      };

      return (
        <View key={item.id} style={[styles.listCard, styles.featureListCard, { padding: 14, gap: 8 }]}>
          {item.groupName ? (
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FFF4E8', borderWidth: 1, borderColor: '#F6DEC5' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#B86A17', textTransform: 'uppercase' }}>
                {item.groupName}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#EADBCB',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {item.authorPhoto ? (
                <Image source={{ uri: item.authorPhoto }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="person-outline" size={14} color="#A85D18" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1F2937' }}>{item.authorName}</Text>
                {item.authorPlan ? (
                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: '#D97706', fontWeight: '800', textTransform: 'uppercase' }}>
                      {item.authorPlan}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{formatDate(item.date)}</Text>
            </View>
            {item.isPinned ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="pin" size={12} color="#F1842D" />
                <Text style={{ fontSize: 9, color: '#F1842D', fontWeight: '700' }}>Pinned</Text>
              </View>
            ) : null}
          </View>

          <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>
            {item.content}
          </Text>

          {Array.isArray(item.tags) && item.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {item.tags.slice(0, 4).map((tag: string, index: number) => (
                <View
                  key={`${item.id}-tag-${index}`}
                  style={{
                    minHeight: 28,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: '#FFFBF6',
                    borderWidth: 1,
                    borderColor: '#E8DED0',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#7C5A3B', fontWeight: '700' }}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />

          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <Pressable
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 },
                pressed && { backgroundColor: '#F3F4F6' }
              ]}
              onPress={() => handleLikePress(item.id)}
            >
              <Ionicons
                name={item.userLiked ? "heart" : "heart-outline"}
                size={16}
                color={item.userLiked ? "#DC2626" : "#4B5563"}
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: item.userLiked ? "#DC2626" : "#4B5563" }}>
                {item.likeCount}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 },
                pressed && { backgroundColor: '#F3F4F6' }
              ]}
              onPress={() => handleCommentsPress(item.id)}
            >
              <Ionicons name="chatbubble-outline" size={15} color="#4B5563" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#4B5563' }}>
                {item.commentCount}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }
    case 'comment_list': {
      return (
        <View key={item.id} style={[styles.listCard, styles.featureListCard, { padding: 14, gap: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#FFF4E8',
              borderWidth: 1,
              borderColor: '#F2CDA5',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {item.authorPhoto ? (
                <Image source={{ uri: item.authorPhoto }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="#A85D18" />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1F2937' }}>{item.authorName}</Text>
                {item.authorPlan ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FFF4E8', borderWidth: 1, borderColor: '#F6DEC5' }}>
                    <Text style={{ fontSize: 9, color: '#B86A17', fontWeight: '800', textTransform: 'uppercase' }}>
                      {item.authorPlan}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{formatDate(item.date)}</Text>
            </View>

            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 10, color: '#4B5563', fontWeight: '700' }}>{item.likeCount || 0} likes</Text>
            </View>
          </View>

          <View style={{ borderLeftWidth: 3, borderLeftColor: '#F2CDA5', paddingLeft: 10 }}>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19 }}>
              {item.content}
            </Text>
          </View>
        </View>
      );
    }
    default:
      return null;
  }
};

const getToneStyle = (tone: AIToolPresentationSection['tone']) => {
  switch (tone) {
    case 'orange':
      return {
        borderColor: '#F4CDA1',
        backgroundColor: '#FFF4E8',
        chipStyle: styles.statusPillOrange,
        iconBg: '#FFE9D2',
        iconBorder: '#F2CDA5',
        iconColor: '#F1842D',
      };
    case 'green':
      return {
        borderColor: '#D8EEDC',
        backgroundColor: '#F4FBF5',
        chipStyle: styles.statusPillGreen,
        iconBg: '#E6F4EA',
        iconBorder: '#A7F3D0',
        iconColor: '#10B981',
      };
    case 'blue':
      return {
        borderColor: '#D7E6FF',
        backgroundColor: '#F5F9FF',
        chipStyle: styles.statusPillBlue,
        iconBg: '#EBF5FF',
        iconBorder: '#BFDBFE',
        iconColor: '#3B82F6',
      };
    case 'red':
      return {
        borderColor: '#F7D2CF',
        backgroundColor: '#FFF5F4',
        chipStyle: styles.statusPillRed,
        iconBg: '#FEE2E2',
        iconBorder: '#FCA5A5',
        iconColor: '#EF4444',
      };
    default:
      return {
        borderColor: '#E8DED0',
        backgroundColor: '#FFF9F2',
        chipStyle: styles.statusPillNeutral,
        iconBg: '#FFF6EC',
        iconBorder: '#F6DEC5',
        iconColor: '#F1842D',
      };
  }
};

const AddressFormSection = ({
  section,
  onActionPress,
  pulse,
}: {
  section: AIToolPresentationSection;
  onActionPress?: (section: AIToolPresentationSection) => void | Promise<void>;
  pulse: Animated.Value;
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [type, setType] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const addAddress = useAddressStore((state) => state.addAddress);

  const handleSubmit = async () => {
    setErrorMsg('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedLine1 = addressLine1.trim();
    const trimmedLine2 = addressLine2.trim();
    const trimmedLandmark = landmark.trim();
    const trimmedCity = city.trim();
    const trimmedState = state.trim();
    const trimmedPincode = pincode.trim();

    if (!trimmedName || !trimmedPhone || !trimmedLine1 || !trimmedCity || !trimmedState || !trimmedPincode) {
      setErrorMsg('Please fill in all required fields (*).');
      return;
    }

    const cleanPhone = trimmedPhone.replace('+91', '').trim();
    if (!/^\d{10}$/.test(cleanPhone)) {
      setErrorMsg('Please enter a valid 10-digit phone number.');
      return;
    }

    if (!/^\d{6}$/.test(trimmedPincode)) {
      setErrorMsg('Please enter a valid 6-digit PIN code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addAddress({
        fullName: trimmedName,
        phone: trimmedPhone,
        alternatePhone: undefined,
        addressLine1: trimmedLine1,
        addressLine2: trimmedLine2 || undefined,
        landmark: trimmedLandmark || undefined,
        city: trimmedCity,
        state: trimmedState,
        pincode: trimmedPincode,
        type: type.toLowerCase(),
        country: 'India',
        isDefault: false,
      });

      if (result && result._id) {
        if (onActionPress) {
          await onActionPress({
            kind: 'action_status',
            title: `Deliver to ${result.fullName}`,
            ctaType: 'select_address',
            ctaLabel: 'Select Address',
            metadata: {
              addressId: result._id,
              fullName: result.fullName,
            },
          } as any);
        }
      } else {
        setErrorMsg('Failed to save address. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving the address.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tone = getToneStyle(section.tone || 'orange');

  return (
    <Animated.View
      style={[
        styles.sectionCard,
        {
          borderColor: tone.borderColor,
          backgroundColor: tone.backgroundColor,
          transform: [{ scale: pulse }],
        },
        styles.actionCard,
      ]}
    >
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionHeadingWrap}>
          <View
            style={[
              styles.sectionIconWrap,
              {
                backgroundColor: tone.iconBg,
                borderColor: tone.iconBorder,
              },
            ]}
          >
            <Ionicons name={(section.icon || 'map-outline') as any} size={16} color={tone.iconColor} />
          </View>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      </View>

      <View style={styles.formContainer}>
        {/* Full Name */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Full Name *</Text>
          <TextInput
            style={styles.formInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. John Doe"
            placeholderTextColor="#9CA3AF"
            editable={!isSubmitting}
          />
        </View>

        {/* Phone Number */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Phone Number *</Text>
          <TextInput
            style={styles.formInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 9876543210"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            editable={!isSubmitting}
          />
        </View>

        {/* Address Line 1 */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Address Line 1 (Flat, House, Building) *</Text>
          <TextInput
            style={styles.formInput}
            value={addressLine1}
            onChangeText={setAddressLine1}
            placeholder="e.g. Flat 104, Sunrise Apartments"
            placeholderTextColor="#9CA3AF"
            editable={!isSubmitting}
          />
        </View>

        {/* Address Line 2 */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Address Line 2 (Area, Street, Sector)</Text>
          <TextInput
            style={styles.formInput}
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder="e.g. Sector 15, Vashi"
            placeholderTextColor="#9CA3AF"
            editable={!isSubmitting}
          />
        </View>

        {/* Landmark */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Landmark</Text>
          <TextInput
            style={styles.formInput}
            value={landmark}
            onChangeText={setLandmark}
            placeholder="e.g. Near Ganesha Temple"
            placeholderTextColor="#9CA3AF"
            editable={!isSubmitting}
          />
        </View>

        {/* City & Pincode */}
        <View style={styles.formRow}>
          <View style={[styles.formField, { flex: 1 }]}>
            <Text style={styles.formLabel}>City *</Text>
            <TextInput
              style={styles.formInput}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Mumbai"
              placeholderTextColor="#9CA3AF"
              editable={!isSubmitting}
            />
          </View>
          <View style={[styles.formField, { flex: 1 }]}>
            <Text style={styles.formLabel}>Pincode *</Text>
            <TextInput
              style={styles.formInput}
              value={pincode}
              onChangeText={setPincode}
              placeholder="e.g. 400703"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
              editable={!isSubmitting}
            />
          </View>
        </View>

        {/* State */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>State *</Text>
          <TextInput
            style={styles.formInput}
            value={state}
            onChangeText={setState}
            placeholder="e.g. Maharashtra"
            placeholderTextColor="#9CA3AF"
            editable={!isSubmitting}
          />
        </View>

        {/* Address Type */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Address Type</Text>
          <View style={styles.typeSelectorRow}>
            {(['Home', 'Work', 'Other'] as const).map((t) => {
              const selected = type === t;
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.typeOption,
                    selected && styles.typeOptionSelected,
                  ]}
                  onPress={() => !isSubmitting && setType(t)}
                >
                  <Ionicons
                    name={t === 'Home' ? 'home-outline' : t === 'Work' ? 'briefcase-outline' : 'location-outline'}
                    size={14}
                    color={selected ? '#FFFFFF' : '#8C5424'}
                  />
                  <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {errorMsg ? <Text style={styles.formErrorText}>{errorMsg}</Text> : null}

        <Pressable
          style={[styles.paymentButton, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="save-outline" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.paymentButtonText}>
            {isSubmitting ? 'Saving Address...' : 'Save & Select Address'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const PresentationSection = ({
  section,
  onActionPress,
}: {
  section: AIToolPresentationSection;
  onActionPress?: (section: AIToolPresentationSection) => void | Promise<void>;
}) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const sectionKind = section.kind;
  const isAddressForm = sectionKind === 'address_form';

  const isActionCard =
    sectionKind === 'progress_card' ||
    sectionKind === 'status_card' ||
    sectionKind === 'action_status' ||
    sectionKind === 'payment_card' ||
    sectionKind === 'order_summary' ||
    sectionKind === 'order_confirmed' ||
    sectionKind === 'payment_link_card';

  useEffect(() => {
    if (!isActionCard || sectionKind === 'payment_card' || !section.animation || section.animation === 'settled') {
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [isActionCard, pulse, section.animation, sectionKind]);

  if (isAddressForm) {
    return (
      <AddressFormSection
        section={section}
        onActionPress={onActionPress}
        pulse={pulse}
      />
    );
  }

  if (section.kind === 'comparison_card') {
    const items = Array.isArray(section.items) ? section.items : [];
    const recommendedId = String(section.recommendedId || '').trim();
    const recommendedTitle = String(section.recommendedTitle || '').trim();
    const comparisonMode =
      section.comparisonMode ||
      (items.some((item: any) => item?.duration || item?.progressLabel || item?.videoCountLabel || item?.pdfCountLabel)
        ? 'course'
        : 'event');

    return (
      <View style={[styles.sectionCard, styles.comparisonSectionCard]}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionHeadingWrap}>
            <View style={[styles.sectionIconWrap, styles.sectionIconNeutral]}>
              <Ionicons name="git-compare-outline" size={16} color="#F1842D" />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          {section.status ? (
            <Text style={[styles.statusPill, styles.statusPillOrange]}>
              {formatLabel(section.status)}
            </Text>
          ) : null}
        </View>

        {!!recommendedTitle && (
          <View style={styles.comparisonWinnerBanner}>
            <Ionicons name="sparkles-outline" size={14} color="#C26D1D" />
            <Text style={styles.comparisonWinnerText}>{recommendedTitle} is the strongest match</Text>
          </View>
        )}

        {Array.isArray(section.rows) && section.rows.length > 0 ? (
          <View style={styles.comparisonMetricGrid}>
            {section.rows.map((row) =>
              renderComparisonMetric(row.label, row.value, { accent: row.label.toLowerCase() === 'best match' })
            )}
          </View>
        ) : null}

        <View style={styles.comparisonCardStack}>
          {items.map((item: any) => {
            const isRecommended = recommendedId && String(item?.id || '') === recommendedId;
            if (comparisonMode === 'course') {
              return (
                <View
                  key={`${section.kind}-${item.id || item.title}`}
                  style={[styles.listCard, styles.featureListCard, styles.comparisonEventCard, isRecommended && styles.comparisonEventCardRecommended]}
                >
                  <View style={styles.listHeaderRow}>
                    <View style={styles.listTitleWrap}>
                      <View style={styles.comparisonTitleRow}>
                        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                        {isRecommended ? (
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedBadgeText}>Recommended</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.eventBadgeRow}>
                        {renderMetaTagCard(`${item.id}-category`, item.category, 'accent')}
                        {renderMetaTagCard(`${item.id}-status`, item.status)}
                        {renderMetaTagCard(`${item.id}-completed`, item.completionLabel)}
                      </View>
                    </View>
                  </View>
                  {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
                  <View style={styles.detailGrid}>
                    {renderDetailCard(`${item.id}-duration`, 'time-outline', item.duration)}
                    {renderDetailCard(`${item.id}-progress`, 'trending-up-outline', item.progressLabel)}
                    {renderDetailCard(`${item.id}-videos`, 'play-circle-outline', item.videoCountLabel)}
                    {renderDetailCard(`${item.id}-pdfs`, 'document-text-outline', item.pdfCountLabel)}
                    {renderDetailCard(`${item.id}-last-active`, 'flash-outline', item.lastAccessedLabel)}
                  </View>
                </View>
              );
            }

            return (
              <View
                key={`${section.kind}-${item.id || item.title}`}
                style={[styles.listCard, styles.featureListCard, styles.comparisonEventCard, isRecommended && styles.comparisonEventCardRecommended]}
              >
                <View style={styles.listHeaderRow}>
                  <View style={styles.listTitleWrap}>
                    <View style={styles.comparisonTitleRow}>
                      <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                      {isRecommended ? (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>Recommended</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.eventBadgeRow}>
                      {renderMetaTagCard(`${item.id}-category`, item.category, 'accent')}
                      {renderMetaTagCard(`${item.id}-location-type`, item.locationType)}
                      {renderMetaTagCard(`${item.id}-status`, item.status)}
                    </View>
                  </View>
                  <Text style={[styles.statusPill, item.isPaid ? styles.statusPillOrange : styles.statusPillGreen]}>
                    {item.priceLabel}
                  </Text>
                </View>
                {!!item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
                <View style={styles.detailGrid}>
                  {renderDetailCard(`${item.id}-date`, 'calendar-outline', formatDate(item.date))}
                  {renderDetailCard(`${item.id}-time`, 'time-outline', item.time)}
                  {renderDetailCard(`${item.id}-location`, 'location-outline', item.location, { wide: true })}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (
    section.kind === 'progress_card' ||
    section.kind === 'status_card' ||
    section.kind === 'action_status' ||
    section.kind === 'payment_card' ||
    section.kind === 'order_summary' ||
    section.kind === 'order_confirmed' ||
    section.kind === 'payment_link_card'
  ) {
    const isPayment = (section.kind === 'payment_card' || section.kind === 'payment_link_card') && !!section.paymentUrl;
    const tone = getToneStyle(
      section.tone ||
      (section.kind === 'order_confirmed' ? 'green' : (section.kind === 'payment_link_card' ? 'orange' : (isPayment ? 'orange' : 'neutral')))
    );
    const communityPreview = section.kind === 'action_status' ? renderCommunityActionPreview(section) : null;
    const hasCommunityPreview = !!communityPreview;

    const handleActionPress = () => {
      if (section.ctaType && onActionPress) {
        onActionPress(section);
        return;
      }
      if (isPayment && section.paymentUrl) {
        void Linking.openURL(section.paymentUrl);
      }
    };
    const actionIcon =
      section.ctaType === 'navigate_membership'
        ? 'arrow-forward'
        : section.ctaType === 'membership_payment' || section.ctaType === 'event_payment' || section.ctaType === 'open_payment_link'
          ? 'card-outline'
          : section.ctaType === 'confirm_order'
            ? 'cart-outline'
            : section.ctaType === 'confirm_order_cancellation'
              ? 'close-circle-outline'
              : 'sparkles-outline';

    return (
      <Animated.View
        style={[
          styles.sectionCard,
          {
            borderColor: tone.borderColor,
            backgroundColor: tone.backgroundColor,
            transform: [{ scale: pulse }],
          },
          isPayment && styles.paymentCard,
          section.kind === 'action_status' && styles.actionCard,
        ]}
      >
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionHeadingWrap}>
            <View
              style={[
                styles.sectionIconWrap,
                {
                  backgroundColor: tone.iconBg,
                  borderColor: tone.iconBorder,
                },
                isPayment && styles.sectionIconPayment,
              ]}
            >
              <Ionicons
                name={(section.icon || (isPayment ? 'card-outline' : 'sparkles-outline')) as any}
                size={16}
                color={tone.iconColor}
              />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          {section.status ? (
            <Text style={[styles.statusPill, tone.chipStyle]}>
              {section.status}
            </Text>
          ) : null}
        </View>
        {!!section.message && <Text style={styles.sectionMessage}>{section.message}</Text>}
        {communityPreview}
        {typeof section.progress === 'number' ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, section.progress))}%` }]} />
          </View>
        ) : null}
        {!hasCommunityPreview ? renderRows(section.rows) : null}
        {Array.isArray(section.slots) && section.slots.length > 0 ? (
          <View style={styles.slotsContainer}>
            <Text style={styles.slotsTitle}>Available Times</Text>
            <View style={styles.slotsGrid}>
              {section.slots.map((slot) => (
                <View key={slot} style={styles.slotPill}>
                  <Ionicons name="time-outline" size={11} color="#A85D18" style={{ marginRight: 3 }} />
                  <Text style={styles.slotText}>{slot}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {section.ctaLabel ? (
          <Pressable style={[styles.paymentButton, section.kind === 'action_status' && styles.secondaryActionButton, { marginTop: 12 }]} onPress={handleActionPress}>
            <Ionicons name={actionIcon as any} size={16} color="#FFFFFF" />
            <Text style={styles.paymentButtonText}>{section.ctaLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.listStack}>
        {Array.isArray(section.items) ? section.items.map((item) => renderListItem(section, item, onActionPress)) : null}
      </View>
    </View>
  );
};

export default function AIToolPresentation({ presentation, onActionPress }: Props) {
  if (!presentation?.sections?.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {presentation.sections.map((section, index) => (
        <PresentationSection
          key={`${section.kind}-${section.title}-${index}`}
          section={section}
          onActionPress={onActionPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    gap: 10,
    width: '100%',
  },
  sectionCard: {
    backgroundColor: '#FFF9F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0DFC9',
    padding: 12,
    gap: 10,
  },
  paymentCard: {
    backgroundColor: '#FFF4E8',
    borderColor: '#F4CDA1',
  },
  actionCard: {
    shadowColor: '#D07A25',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  comparisonSectionCard: {
    backgroundColor: '#FFF8F0',
    borderColor: '#F1DEC8',
    padding: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionHeadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionIconNeutral: {
    backgroundColor: '#FFF6EC',
    borderColor: '#F6DEC5',
  },
  sectionIconPayment: {
    backgroundColor: '#FFE9D2',
    borderColor: '#F2CDA5',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },
  sectionMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },
  listStack: {
    gap: 8,
  },
  comparisonCardStack: {
    gap: 10,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFE5D9',
    padding: 12,
    gap: 8,
  },
  featureListCard: {
    padding: 14,
    borderColor: '#EADBCB',
    shadowColor: '#7C4A23',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECE2D6',
    overflow: 'hidden',
    shadowColor: '#7C4A23',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  courseImageContainer: {
    position: 'relative',
    height: 130,
    width: '100%',
  },
  courseBannerImage: {
    width: '100%',
    height: '100%',
  },
  courseBannerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseCategoryOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  courseCategoryOverlayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  courseLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseCardBody: {
    padding: 14,
    gap: 10,
  },
  courseCardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#1F2937',
  },
  courseCardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5B6472',
  },
  coursePlanBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  coursePlanBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FFF1E2',
    borderWidth: 1,
    borderColor: '#F1DFC8',
  },
  coursePlanBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B85C14',
  },
  courseDivider: {
    height: 1,
    backgroundColor: '#ECE2D6',
    marginVertical: 2,
  },
  courseStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  courseAccessAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#F4D6B1',
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
  courseAccessAlertText: {
    flexShrink: 1,
    fontSize: 11,
    color: '#9A6B44',
    lineHeight: 16,
  },
  comparisonEventCard: {
    backgroundColor: '#FFFFFF',
  },
  comparisonEventCardRecommended: {
    borderColor: '#F0C795',
    backgroundColor: '#FFFDF9',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  listTitleWrap: {
    flex: 1,
    gap: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: -2,
  },
  comparisonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailingMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A16207',
  },
  itemDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  metaTagCard: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  metaTagCardAccent: {
    backgroundColor: '#FFF4E7',
    borderColor: '#F4DDC2',
  },
  metaTagCardNeutral: {
    backgroundColor: '#F8F3ED',
    borderColor: '#ECE1D3',
  },
  metaTagCardText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaTagCardTextAccent: {
    color: '#A85D18',
  },
  metaTagCardTextNeutral: {
    color: '#6B7280',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF1E2',
    color: '#A85D18',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeMuted: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F5EFE8',
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#9A6B44',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  metaCell: {
    fontSize: 11,
    color: '#6B7280',
    backgroundColor: '#F8F4EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  detailCard: {
    minHeight: 42,
    maxWidth: '100%',
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFFAF4',
    borderWidth: 1,
    borderColor: '#EEDFCF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailCardWide: {
    width: '100%',
  },
  detailCardIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#FFF1E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailCardText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#5B6472',
    fontWeight: '600',
  },
  rowStack: {
    gap: 8,
  },
  comparisonMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  comparisonMetricCard: {
    minWidth: '47%',
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9DCCF',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  comparisonMetricCardAccent: {
    borderColor: '#F1C894',
    backgroundColor: '#FFF6EB',
  },
  comparisonMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A6B44',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  comparisonMetricValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  comparisonMetricValueAccent: {
    color: '#A85D18',
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
  },
  rowValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'right',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F3E7D8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#F1842D',
  },
  statusPill: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: '42%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  statusPillGreen: {
    backgroundColor: '#EAF7EE',
    color: '#1F7A45',
  },
  statusPillOrange: {
    backgroundColor: '#FFE7D1',
    color: '#B85C14',
  },
  statusPillNeutral: {
    backgroundColor: '#F2F4F7',
    color: '#667085',
  },
  statusPillBlue: {
    backgroundColor: '#E8F1FF',
    color: '#285EA8',
  },
  statusPillRed: {
    backgroundColor: '#FCEAE8',
    color: '#B9382F',
  },
  comparisonWinnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF1E2',
    borderWidth: 1,
    borderColor: '#F4D6B1',
  },
  comparisonWinnerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#9A5B16',
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF1E2',
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B85C14',
  },
  paymentButton: {
    marginTop: 4,
    backgroundColor: '#F1842D',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  communityActionPreviewWrap: {
    marginTop: 14,
    gap: 10,
  },
  communityActionTargetCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEDFCF',
    backgroundColor: '#FFF9F2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  communityActionTargetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  communityActionTargetIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1E2',
    borderWidth: 1,
    borderColor: '#F3DEC7',
  },
  communityActionTargetLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#A86D32',
  },
  communityActionQuoteCard: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  communityActionQuoteMark: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
    color: '#E2B788',
    marginTop: -1,
  },
  communityActionTargetText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#5B4330',
  },
  communityActionContentCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1E3D4',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#D97A28',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  communityActionContentLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#C26D1D',
  },
  communityActionContentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#243245',
    fontWeight: '600',
  },
  communityActionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  communityActionMetaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF6EC',
    borderWidth: 1,
    borderColor: '#F3DEC7',
    maxWidth: '100%',
  },
  communityActionMetaText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#8E5E35',
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  slotsContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEDFCF',
    paddingTop: 12,
  },
  slotsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A6B44',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#EEDFCF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  slotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#253243',
  },
  productThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F5EFEB',
  },
  productThumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F5EFEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F1842D',
  },
  productMrpText: {
    fontSize: 10,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  buyNowMiniButton: {
    backgroundColor: '#F1842D',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowMiniButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  formContainer: {
    marginTop: 8,
    gap: 12,
    width: '100%',
  },
  formField: {
    gap: 4,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C5424',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADBCB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1F2937',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EADBCB',
    backgroundColor: '#FFFFFF',
  },
  typeOptionSelected: {
    borderColor: '#F1842D',
    backgroundColor: '#F1842D',
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8C5424',
  },
  typeOptionTextSelected: {
    color: '#FFFFFF',
  },
  formErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 2,
  },
});
