// Chat with a match. New messages arrive live. The ⋯ button has Unmatch / Block / Report.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, colors, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/types';

type Other = { id: string; name: string };

export default function ChatScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myId = session!.user.id;

  const [other, setOther] = useState<Other | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  // Load who we're talking to + the message history
  useEffect(() => {
    (async () => {
      const { data: match } = await supabase
        .from('matches')
        .select('user_a:profiles!matches_user_a_fkey(id, name), user_b:profiles!matches_user_b_fkey(id, name)')
        .eq('id', matchId)
        .maybeSingle();
      if (!match) {
        Alert.alert('This match is no longer available');
        router.back();
        return;
      }
      const m = match as unknown as { user_a: Other; user_b: Other };
      setOther(m.user_a.id === myId ? m.user_b : m.user_a);

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      setMessages((data as Message[]) ?? []);
    })();
  }, [matchId, myId]);

  // Listen for new messages in this chat
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ match_id: matchId, body })
      .select()
      .single();
    if (error) {
      Alert.alert('Message not sent', error.message);
      setDraft(body);
      return;
    }
    setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data as Message]));
  }

  function showMenu() {
    if (!other) return;
    Alert.alert(other.name, undefined, [
      {
        text: 'Unmatch',
        onPress: async () => {
          await supabase.from('matches').delete().eq('id', matchId);
          router.back();
        },
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('blocks').insert({ blocked: other.id });
          router.back();
        },
      },
      { text: 'Report', onPress: () => setReporting(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitReport() {
    if (!other || !reportReason.trim()) return;
    const { error } = await supabase.from('reports').insert({ reported: other.id, reason: reportReason.trim() });
    setReporting(false);
    setReportReason('');
    if (error) Alert.alert('Could not send report', error.message);
    else Alert.alert('Thanks for telling us', 'We’ll review this. You can also block them from the ⋯ menu.');
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: other?.name ?? '',
          headerRight: () => (
            <Pressable onPress={showMenu} hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Say hi to {other?.name}! Try asking about their budget or where they want to live.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender === myId;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 16 }}>{item.body}</Text>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <Pressable onPress={send} style={styles.send} disabled={!draft.trim()}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={reporting} transparent animationType="fade" onRequestClose={() => setReporting(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Report {other?.name}</Text>
            <Field label="What happened?" value={reportReason} onChangeText={setReportReason} multiline />
            <Button title="Send report" onPress={submitReport} disabled={!reportReason.trim()} />
            <Button title="Cancel" variant="secondary" onPress={() => setReporting(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderRadius: 20,
    color: colors.text,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.card, borderRadius: 24, padding: 24, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
});
