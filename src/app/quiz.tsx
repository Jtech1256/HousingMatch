// The lifestyle quiz. Answers (1-5 for each question) drive the match score.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { QUIZ } from '@/lib/options';
import { supabase } from '@/lib/supabase';

export default function QuizScreen() {
  const { profile, refreshProfile } = useAuth();
  const retaking = !!profile?.quiz;
  const [answers, setAnswers] = useState<(number | null)[]>(profile?.quiz ?? QUIZ.map(() => null));
  const [saving, setSaving] = useState(false);

  const setAnswer = (question: number, value: number) =>
    setAnswers((prev) => prev.map((a, i) => (i === question ? value : a)));

  const allAnswered = answers.every((a) => a !== null);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ quiz: answers }).eq('id', profile!.id);
    if (error) {
      setSaving(false);
      Alert.alert('Could not save', error.message);
      return;
    }
    await refreshProfile();
    setSaving(false);
    if (retaking) router.back();
    else router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Be honest — this is how we find people you’ll actually get along with. Nobody sees your answers.
      </Text>

      {QUIZ.map((q, i) => (
        <View key={q.question} style={styles.question}>
          <Text style={styles.questionText}>
            {i + 1}. {q.question}
          </Text>
          <View style={styles.scale}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setAnswer(i, value)}
                style={[styles.dot, answers[i] === value && styles.dotSelected]}>
                <Text style={[styles.dotText, answers[i] === value && { color: '#fff' }]}>{value}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.ends}>
            <Text style={styles.endText}>{q.low}</Text>
            <Text style={[styles.endText, { textAlign: 'right' }]}>{q.high}</Text>
          </View>
        </View>
      ))}

      <Button
        title={retaking ? 'Save answers' : 'Start swiping'}
        onPress={save}
        loading={saving}
        disabled={!allAnswered}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 48 },
  intro: { fontSize: 15, color: colors.muted },
  question: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionText: { fontSize: 16, fontWeight: '600', color: colors.text },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  endText: { flex: 1, fontSize: 12, color: colors.muted },
});
