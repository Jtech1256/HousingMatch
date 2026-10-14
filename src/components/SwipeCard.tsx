// The draggable profile card. Drag right = like, drag left = pass.
// Parents can also trigger a swipe from a button via the `ref` (see Discover screen).
import { Image } from 'expo-image';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { HOUSING_LABEL } from '@/lib/options';
import type { Candidate } from '@/lib/types';
import { colors } from './ui';

export type SwipeCardHandle = { swipe: (direction: 'left' | 'right') => void };

type Props = {
  candidate: Candidate;
  onSwiped: (liked: boolean) => void;
  ref?: React.Ref<SwipeCardHandle>;
};

const SWIPE_THRESHOLD = 120; // how far (in pixels) you have to drag to count as a swipe

export function SwipeCard({ candidate, onSwiped, ref }: Props) {
  const { width } = useWindowDimensions();
  const position = useRef(new Animated.ValueXY()).current;

  const flyOff = (direction: 'left' | 'right') => {
    Animated.timing(position, {
      toValue: { x: direction === 'right' ? width * 1.5 : -width * 1.5, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      onSwiped(direction === 'right');
    });
  };

  useImperativeHandle(ref, () => ({ swipe: flyOff }));

  // The PanResponder below is created once, so it reads the latest flyOff through this ref.
  const flyOffRef = useRef(flyOff);
  useEffect(() => {
    flyOffRef.current = flyOff;
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 5,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_THRESHOLD) flyOffRef.current('right');
        else if (g.dx < -SWIPE_THRESHOLD) flyOffRef.current('left');
        else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const c = candidate;
  const reasons = [
    c.shared_areas.length > 0 && `Both looking at ${c.shared_areas.join(', ')}`,
    c.shared_interests.length > 0 && `Both into ${c.shared_interests.join(', ')}`,
  ].filter(Boolean) as string[];

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.card, { transform: [...position.getTranslateTransform(), { rotate }] }]}>
      <View style={styles.photoWrap}>
        {c.photo_url ? (
          <Image source={{ uri: c.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noPhoto]}>
            <Text style={styles.initial}>{c.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{c.score}% match</Text>
        </View>
        <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
          <Text style={[styles.stampText, { color: colors.like }]}>ROOMIE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
          <Text style={[styles.stampText, { color: colors.nope }]}>PASS</Text>
        </Animated.View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>
          {c.name}
          {c.grad_year ? <Text style={styles.sub}>  ’{String(c.grad_year).slice(2)}</Text> : null}
        </Text>
        {!!c.major && <Text style={styles.sub}>{c.major}</Text>}
        <Text style={styles.detail}>
          ${c.budget_min}–${c.budget_max}/mo · {HOUSING_LABEL[c.housing_type]} · Move in{' '}
          {formatMonth(c.move_in)}
        </Text>
        {reasons.map((r) => (
          <Text key={r} style={styles.reason}>
            ✓ {r}
          </Text>
        ))}
        {!!c.bio && (
          <Text style={styles.bio} numberOfLines={3}>
            {c.bio}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

function formatMonth(date: string) {
  const [y, m] = date.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  photoWrap: { flex: 1, backgroundColor: colors.primarySoft },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 96, fontWeight: '700', color: colors.primary },
  scoreBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scoreText: { color: '#fff', fontWeight: '700' },
  stamp: { position: 'absolute', top: 40, borderWidth: 4, borderRadius: 10, paddingHorizontal: 10 },
  likeStamp: { left: 24, borderColor: colors.like, transform: [{ rotate: '-15deg' }] },
  nopeStamp: { right: 24, borderColor: colors.nope, transform: [{ rotate: '15deg' }] },
  stampText: { fontSize: 32, fontWeight: '800' },
  info: { padding: 18, gap: 4 },
  name: { fontSize: 26, fontWeight: '700', color: colors.text },
  sub: { fontSize: 16, color: colors.muted, fontWeight: '400' },
  detail: { fontSize: 14, color: colors.text, marginTop: 4 },
  reason: { fontSize: 14, color: colors.like, fontWeight: '600' },
  bio: { fontSize: 15, color: colors.text, marginTop: 6 },
});
