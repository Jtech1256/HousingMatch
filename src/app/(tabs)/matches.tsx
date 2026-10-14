// Matches: everyone you've mutually liked. Tap one to chat.
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type MiniProfile = { id: string; name: string; photo_url: string | null; major: string };
type MatchRow = { id: string; created_at: string; user_a: MiniProfile; user_b: MiniProfile };

export default function MatchesScreen() {
  const { session } = useAuth();
  const myId = session!.user.id;
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    // Fetch each match along with both people's basic info
    const { data, error } = await supabase
      .from('matches')
      .select(
        'id, created_at, user_a:profiles!matches_user_a_fkey(id, name, photo_url, major), user_b:profiles!matches_user_b_fkey(id, name, photo_url, major)'
      )
      .order('created_at', { ascending: false });
    if (error) console.warn(error.message);
    // A blocked person's profile comes back empty, so leave those out
    setMatches(((data as unknown as MatchRow[]) ?? []).filter((m) => m.user_a && m.user_b));
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // New match while you're on this screen? Show it right away.
  useEffect(() => {
    const channel = supabase
      .channel('my-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (loaded && matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyText}>When someone you liked likes you back, they’ll show up here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      renderItem={({ item }) => {
        const other = item.user_a.id === myId ? item.user_b : item.user_a;
        return (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}>
            {other.photo_url ? (
              <Image source={{ uri: other.photo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.initial}>{other.name.charAt(0)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{other.name}</Text>
              <Text style={styles.sub}>{other.major || 'Tap to say hi'}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '700', color: colors.primary },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  sub: { fontSize: 14, color: colors.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
