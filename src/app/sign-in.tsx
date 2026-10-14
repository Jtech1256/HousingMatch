// Sign in with a school email. Supabase emails a one-time code — no passwords to manage.
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, colors, Field } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  async function sendCode() {
    if (!cleanEmail.endsWith('.edu')) {
      Alert.alert('School email required', 'Use your .edu email so we know you’re a student.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
    setBusy(false);
    if (error) Alert.alert('Could not send code', error.message);
    else setCodeSent(true);
  }

  async function verifyCode() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) Alert.alert('That code didn’t work', error.message);
    // On success the app automatically moves on (see app/_layout.tsx)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={{ gap: 8 }}>
          <Text style={styles.logo}>RoomieMatch</Text>
          <Text style={styles.tagline}>Find a roommate who actually fits how you live.</Text>
        </View>

        {!codeSent ? (
          <View style={styles.form}>
            <Field
              label="School email"
              placeholder="you@vt.edu"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <Button title="Send me a code" onPress={sendCode} loading={busy} disabled={!email} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.tagline}>We emailed a code to {cleanEmail}.</Text>
            <Field
              label="Code"
              placeholder="123456"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={8}
            />
            <Button title="Sign in" onPress={verifyCode} loading={busy} disabled={code.trim().length < 6} />
            <Button title="Use a different email" variant="secondary" onPress={() => setCodeSent(false)} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 32 },
  logo: { fontSize: 36, fontWeight: '800', color: colors.primary },
  tagline: { fontSize: 16, color: colors.muted },
  form: { gap: 14 },
});
