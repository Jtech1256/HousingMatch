// The root of the app. Decides which screens you're allowed to see:
//   signed out                -> Sign in
//   signed in, no profile     -> Profile setup
//   profile, no quiz yet      -> Lifestyle quiz
//   all done                  -> Main tabs (Discover, Matches, Profile) + chat
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors, Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppStack />
    </AuthProvider>
  );
}

function AppStack() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;

  const signedIn = !!session;
  const hasProfile = !!profile;
  const done = hasProfile && !!profile.quiz;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}>
      {/* The first screen you're allowed to see is where the app opens. */}
      <Stack.Protected guard={done}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && (!hasProfile || done)}>
        <Stack.Screen name="setup" options={{ title: hasProfile ? 'Edit profile' : 'Create your profile' }} />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile}>
        <Stack.Screen name="quiz" options={{ title: 'Living style quiz' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
