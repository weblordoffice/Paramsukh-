import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface AmbientGlowProps {
  children?: React.ReactNode;
  style?: any;
}

export default function AmbientGlow({ children, style }: AmbientGlowProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Cinematic gradient background */}
      <LinearGradient
        colors={['#080C16', '#0E1122', '#140E24', '#0A0716']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Glowing atmospheric violet orb */}
      <View style={[styles.glowOrb, styles.violetOrb]} />

      {/* Glowing atmospheric warm amber/gold orb */}
      <View style={[styles.glowOrb, styles.amberOrb]} />

      {/* Glowing atmospheric deep indigo orb */}
      <View style={[styles.glowOrb, styles.indigoOrb]} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C16',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  violetOrb: {
    width: width * 1.1,
    height: width * 1.1,
    backgroundColor: '#8B5CF6',
    opacity: 0.08,
    top: -width * 0.4,
    left: -width * 0.3,
  },
  amberOrb: {
    width: width * 0.9,
    height: width * 0.9,
    backgroundColor: '#F59E0B',
    opacity: 0.04,
    top: height * 0.25,
    right: -width * 0.4,
  },
  indigoOrb: {
    width: width * 1.3,
    height: width * 1.3,
    backgroundColor: '#4F46E5',
    opacity: 0.06,
    bottom: -height * 0.25,
    left: -width * 0.4,
  },
});
