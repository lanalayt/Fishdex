import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase/client';
import { SUPABASE_ENABLED } from '../supabase/config';
import { generateId } from './id';

const sb = () => supabase as any;

export async function pickRiverPhoto(): Promise<string | null> {
  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
  });

  if (result.canceled || !result.assets?.length) return null;

  return result.assets[0].uri;
}

export async function uploadRiverPhoto(localUri: string, riverId: string): Promise<string | null> {
  if (!SUPABASE_ENABLED || !supabase) return localUri;

  try {
    // For web, we can use the URI directly with Supabase storage
    const fileName = `river_${riverId}_${generateId()}.jpg`;
    const filePath = `rivers/${fileName}`;

    if (Platform.OS === 'web') {
      // Web: fetch the blob and upload
      const response = await fetch(localUri);
      const blob = await response.blob();

      const { error } = await sb().storage
        .from('river-photos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }
    } else {
      // Native: read as form data
      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { error } = await sb().storage
        .from('river-photos')
        .upload(filePath, formData, { contentType: 'multipart/form-data', upsert: true });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }
    }

    // Get public URL
    const { data } = sb().storage
      .from('river-photos')
      .getPublicUrl(filePath);

    return data?.publicUrl || null;
  } catch (e) {
    console.error('Photo upload failed:', e);
    return null;
  }
}

export async function saveRiverImageUrl(riverId: string, imageUrl: string): Promise<void> {
  if (!SUPABASE_ENABLED || !supabase) return;

  await sb().from('rivers').update({ image_url: imageUrl }).eq('id', riverId);
}
