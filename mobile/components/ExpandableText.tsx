import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

interface ExpandableTextProps {
  text?: string | null;
  /** Lines to show when collapsed. */
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  moreLabel?: string;
  lessLabel?: string;
}

/**
 * Text that clamps to `numberOfLines` so the surrounding card keeps a fixed
 * height, and shows a "Show more / Show less" toggle only when the content
 * actually overflows. Overflow is detected by measuring an invisible,
 * unclamped copy of the text (reliable on both iOS and Android).
 */
export default function ExpandableText({
  text,
  numberOfLines = 2,
  style,
  linkStyle,
  moreLabel = 'Show more',
  lessLabel = 'Show less',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  const onMeasure = useCallback((e: any) => {
    setLineCount(e?.nativeEvent?.lines?.length ?? 0);
  }, []);

  if (!text) {
    return null;
  }

  const overflows = lineCount > numberOfLines;

  return (
    <View>
      <Text style={style} numberOfLines={expanded ? undefined : numberOfLines}>
        {text}
      </Text>

      {/* Invisible, unclamped copy used only to count the real number of lines */}
      <Text style={[style, styles.measure]} onTextLayout={onMeasure}>
        {text}
      </Text>

      {overflows && (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.7} hitSlop={8}>
          <Text style={[styles.toggle, linkStyle]}>{expanded ? lessLabel : moreLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  toggle: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
