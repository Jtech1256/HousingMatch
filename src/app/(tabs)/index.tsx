// Discover: the swipe deck.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard';
import { Button, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Candidate } from '@/lib/types';

export default function DiscoverScreen() {
  const { session } = useAuth();
  const myId = session!.user.id;
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMatch, setNewMatch] = useState<{ matchId: string; name: string } | null>(null);
  const cardRef = useRef<SwipeCardHandle>(null);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_candidates', { max_results: 20 });
    if (error) Alert.alert('Could not load people', error.message);
    setDeck((data as Candidate[]) ?? []);
    setLoading(false);
  }, []);

  // Reload whenever you come back to this tab (e.g. after editing your profile)
  useFocusEffect(
    useCallback(() => {
      loadDeck();
    }, [loadDeck])
  );

  async function handleSwiped(liked: boolean) {
    const person = deck[0];
    const rest = deck.slice(1);
    setDeck(rest);

    const { error } = await supabase.from('swipes').insert({ swiper: myId, swipee: person.id, liked });
    if (error) console.warn('Swipe not saved:', error.message);

    if (liked) {
      // If they already liked us, the database just created a match
      const [a, b] = [myId, person.id].sort();
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .eq('user_a', a)
        .eq('user_b', b)
        .maybeSingle();
      if (match) setNewMatch({ matchId: match.id, name: person.name });
    }

    if (rest.length === 0) loadDeck(); // grab the next batch
  }

  if (loading && deck.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (deck.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="home-outline" size={56} color={colors.muted} />
        <Text style={styles.emptyTitle}>You’re all caught up</Text>
        <Text style={styles.emptyText}>
          No one else matches your budget, dates, and housing right now. Check back soon, or widen your
          budget or places in your profile.
        </Text>
        <Button title="Refresh" variant="secondary" onPress={loadDeck} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        {/* Only the top card is shown; key forces a fresh card for each person */}
        <SwipeCard key={deck[0].id} ref={cardRef} candidate={deck[0]} onSwiped={handleSwiped} />
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.circle, { borderColor: colors.nope }]} onPress={() => cardRef.current?.swipe('left')}>
          <Ionicons name="close" size={34} color={colors.nope} />
        </Pressable>
        <Pressable style={[styles.circle, { borderColor: colors.like }]} onPress={() => cardRef.current?.swipe('right')}>
          <Ionicons name="heart" size={30} color={colors.like} />
        </Pressable>
      </View>

      <Modal visible={!!newMatch} transparent animationType="fade" onRequestClose={() => setNewMatch(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.matchTitle}>It’s a match!</Text>
            <Text style={styles.emptyText}>You and {newMatch?.name} both want to room together.</Text>
            <Button
              title="Send a message"
              onPress={() => {
                const id = newMatch!.matchId;
                setNewMatch(null);
                router.push({ pathname: '/chat/[id]', params: { id } });
              }}
            />
            <Button title="Keep swiping" variant="secondary" onPress={() => setNewMatch(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  deck: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingBottom: 4 },
  circle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.card, borderRadius: 24, padding: 24, gap: 14 },
  matchTitle: { fontSize: 30, fontWeight: '800', color: colors.primary, textAlign: 'center' },
});
