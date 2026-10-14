// Create or edit your profile.
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ChipGroup, colors, Field, MultiChipGroup } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  GENDER_OPTIONS,
  HOUSING_OPTIONS,
  INTERESTS,
  OFF_CAMPUS_AREAS,
  ON_CAMPUS_AREAS,
} from '@/lib/options';
import { supabase } from '@/lib/supabase';
import type { Gender, HousingType } from '@/lib/types';

const PREF_OPTIONS = [
  { value: 'any', label: 'Anyone' },
  { value: 'same', label: 'Same gender only' },
] as const;

export default function SetupScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const editing = !!profile;

  // Start from the existing profile when editing, otherwise blank
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? null);
  const [name, setName] = useState(profile?.name ?? '');
  const [major, setMajor] = useState(profile?.major ?? '');
  const [gradYear, setGradYear] = useState(profile?.grad_year ? String(profile.grad_year) : '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [genderPref, setGenderPref] = useState<'same' | 'any'>(profile?.roommate_gender_pref ?? 'any');
  const [housing, setHousing] = useState<HousingType | null>(profile?.housing_type ?? null);
  const [areas, setAreas] = useState<string[]>(profile?.preferred_areas ?? []);
  const [budgetMin, setBudgetMin] = useState(profile ? String(profile.budget_min) : '');
  const [budgetMax, setBudgetMax] = useState(profile ? String(profile.budget_max) : '');
  const [moveIn, setMoveIn] = useState(profile?.move_in ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const areaOptions =
    housing === 'on_campus' ? ON_CAMPUS_AREAS : housing === 'off_campus' ? OFF_CAMPUS_AREAS : [...ON_CAMPUS_AREAS, ...OFF_CAMPUS_AREAS];

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (result.canceled || !session) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const fileData = await (await fetch(asset.uri)).arrayBuffer();
      // Each user uploads into a folder named after their user id (the database enforces this)
      const path = `${session.user.id}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, fileData, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
      if (error) throw error;
      setPhotoUrl(supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    // Check the form before sending it
    const min = parseInt(budgetMin, 10);
    const max = parseInt(budgetMax, 10);
    const year = gradYear ? parseInt(gradYear, 10) : null;
    const problems = [
      !name.trim() && 'your name',
      !gender && 'your gender',
      !housing && 'where you want to live',
      (isNaN(min) || isNaN(max) || min > max) && 'a budget range (low to high)',
      !isValidDate(moveIn) && 'a move-in date like 2027-08-01',
      year !== null && (isNaN(year) || year < 2020 || year > 2040) && 'a real graduation year',
    ].filter(Boolean);
    if (problems.length) {
      Alert.alert('Almost there', `Please add ${problems.join(', ')}.`);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: session!.user.id,
      name: name.trim(),
      photo_url: photoUrl,
      major: major.trim(),
      grad_year: year,
      gender,
      roommate_gender_pref: genderPref,
      housing_type: housing,
      preferred_areas: areas,
      budget_min: min,
      budget_max: max,
      move_in: moveIn,
      interests,
      bio: bio.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await refreshProfile();
    // New users are sent to the quiz automatically. When editing, go back.
    if (editing) router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable onPress={pickPhoto} style={styles.photo}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.photoText}>{uploading ? 'Uploading…' : '+ Add photo'}</Text>
        )}
      </Pressable>

      <Field label="First name" value={name} onChangeText={setName} placeholder="Jordan" />
      <Field label="Major" value={major} onChangeText={setMajor} placeholder="Computer Science" />
      <Field label="Graduation year" value={gradYear} onChangeText={setGradYear} keyboardType="number-pad" placeholder="2029" maxLength={4} />
      <ChipGroup label="I am a" options={GENDER_OPTIONS} value={gender} onChange={setGender} />
      <ChipGroup label="Roommate gender" options={PREF_OPTIONS} value={genderPref} onChange={setGenderPref} />
      <ChipGroup label="Looking for" options={HOUSING_OPTIONS} value={housing} onChange={setHousing} />
      <MultiChipGroup label="Places I'd live (optional)" options={areaOptions} value={areas} onChange={setAreas} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Rent from ($/mo)" value={budgetMin} onChangeText={setBudgetMin} keyboardType="number-pad" placeholder="500" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Rent up to ($/mo)" value={budgetMax} onChangeText={setBudgetMax} keyboardType="number-pad" placeholder="850" />
        </View>
      </View>
      <Field label="Move-in date (YYYY-MM-DD)" value={moveIn} onChangeText={setMoveIn} placeholder="2027-08-01" maxLength={10} />

      <MultiChipGroup label="Interests" options={INTERESTS} value={interests} onChange={setInterests} />
      <Field
        label="About me"
        value={bio}
        onChangeText={setBio}
        placeholder="What would a future roommate want to know?"
        multiline
        maxLength={500}
        style={styles.bio}
      />

      <Button title={editing ? 'Save changes' : 'Next: living style quiz'} onPress={save} loading={saving} disabled={uploading} />
    </ScrollView>
  );
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 18, paddingBottom: 48 },
  photo: {
    alignSelf: 'center',
    width: 150,
    height: 200,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoText: { color: colors.primary, fontWeight: '600' },
  bio: { minHeight: 100, textAlignVertical: 'top' },
});
