// Your own profile: edit it, retake the quiz, or sign out.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { HOUSING_LABEL } from '@/lib/options';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile } = useAuth();
  if (!profile) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {profile.photo_url ? (
        <Image source={{ uri: profile.photo_url }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.noPhoto]}>
          <Text style={styles.initial}>{profile.name.charAt(0)}</Text>
        </View>
      )}
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.sub}>
        {[profile.major, profile.grad_year && `Class of ${profile.grad_year}`, profile.school_domain]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      <View style={styles.box}>
        <Row label="Looking for" value={HOUSING_LABEL[profile.housing_type]} />
        <Row label="Budget" value={`$${profile.budget_min}–$${profile.budget_max}/mo`} />
        <Row label="Move in" value={profile.move_in} />
        {profile.preferred_areas.length > 0 && <Row label="Places" value={profile.preferred_areas.join(', ')} />}
        {profile.interests.length > 0 && <Row label="Interests" value={profile.interests.join(', ')} />}
      </View>

      <Button title="Edit profile" onPress={() => router.push('/setup')} />
      <Button title="Retake living style quiz" variant="secondary" onPress={() => router.push('/quiz')} />
      <Button title="Sign out" variant="danger" onPress={() => supabase.auth.signOut()} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 48 },
  photo: { alignSelf: 'center', width: 120, height: 120, borderRadius: 60 },
  noPhoto: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 48, fontWeight: '700', color: colors.primary },
  name: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  box: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 12 },
  rowLabel: { width: 90, fontSize: 14, color: colors.muted },
  rowValue: { flex: 1, fontSize: 14, color: colors.text },
});
