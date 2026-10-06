import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, StatusBar, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@prayer_journal_devotions_permanent_v1';

export default function PrayerJournalScreen({ navigation }) {
  const [senderName, setSenderName] = useState('');
  const [devotionTitle, setDevotionTitle] = useState('');
  const [biblePassage, setBiblePassage] = useState('');
  const [devotionText, setDevotionText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const [requests, setRequests] = useState([]);

  // Kung may laman, ine-edit ang devotion na may ganitong id
  const [editingId, setEditingId] = useState(null);
  const scrollRef = useRef(null);

  // Load saved devotions and pictures when the app opens
  useEffect(() => {
    loadStoredDevotions();
  }, []);

  const loadStoredDevotions = async () => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedData !== null) {
        setRequests(JSON.parse(storedData));
      } else {
        const initialItems = [
          {
            id: '1',
            title: 'Walking in Faith',
            passage: 'Proverbs 3:5-6',
            sender: 'John Doe',
            text: 'Trust in the Lord with all your heart...',
            timestamp: 'Oct 01, 2026 • 08:30 AM',
            status: 'Pending',
            imageUri: null,
          }
        ];
        setRequests(initialItems);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialItems));
      }
    } catch (error) {
      console.error('Failed to load devotions.', error);
    }
  };

  const saveDevotionsToStorage = async (newRequestsList) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRequestsList));
    } catch (error) {
      console.error('Failed to save devotions.', error);
    }
  };

  // Function to convert image to Base64 so it persists permanently in AsyncStorage
  const convertImageToBase64 = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return uri; // Fallback to uri if conversion fails
    }
  };

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const base64Uri = await convertImageToBase64(result.assets[0].uri);
      setSelectedImage(base64Uri);
    }
  };

  const takePhotoWithCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'You need to grant camera permission to use this feature.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const base64Uri = await convertImageToBase64(result.assets[0].uri);
      setSelectedImage(base64Uri);
    }
  };

  const resetForm = () => {
    setSenderName('');
    setDevotionTitle('');
    setBiblePassage('');
    setDevotionText('');
    setSelectedImage(null);
    setEditingId(null);
  };

  // POST (bago) o SAVE CHANGES (kung ine-edit)
  const handleAddRequest = async () => {
    if (!devotionTitle.trim() && !devotionText.trim() && !selectedImage) {
      Alert.alert('Required', 'Please add at least a title, text, or photo for your devotion.');
      return;
    }

    // EDIT MODE: i-update ang existing na devotion (hindi nagbabago ang petsa at status)
    if (editingId) {
      const updatedRequests = requests.map(item =>
        item.id === editingId
          ? {
              ...item,
              title: devotionTitle.trim() || 'Untitled Devotion',
              passage: biblePassage.trim(),
              sender: senderName.trim() || 'Anonymous',
              text: devotionText.trim(),
              imageUri: selectedImage,
            }
          : item
      );
      setRequests(updatedRequests);
      await saveDevotionsToStorage(updatedRequests);
      resetForm();
      Alert.alert('Saved ✅', 'Successfully updated devotion!');
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newRequest = {
      id: Date.now().toString(),
      title: devotionTitle.trim() || 'Untitled Devotion',
      passage: biblePassage.trim(),
      sender: senderName.trim() || 'Anonymous',
      text: devotionText.trim(),
      timestamp: `${formattedDate} • ${formattedTime}`,
      status: 'Pending',
      imageUri: selectedImage, // Ito na ay Base64 string kaya permanenteng mase-save
    };

    const updatedRequests = [newRequest, ...requests];
    setRequests(updatedRequests);
    await saveDevotionsToStorage(updatedRequests);

    resetForm();
  };

  // EDIT: ilagay sa form ang laman ng devotion at umakyat sa taas
  const handleEdit = (item) => {
    setEditingId(item.id);
    setSenderName(item.sender === 'Anonymous' ? '' : (item.sender || ''));
    setDevotionTitle(item.title === 'Untitled Devotion' ? '' : (item.title || ''));
    setBiblePassage(item.passage || '');
    setDevotionText(item.text || '');
    setSelectedImage(item.imageUri || null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // DELETE: may kumpirmasyon muna
  const handleDelete = (item) => {
    Alert.alert(
      'Delete Devotion',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedRequests = requests.filter(r => r.id !== item.id);
            setRequests(updatedRequests);
            await saveDevotionsToStorage(updatedRequests);
            // Kung ito ang kasalukuyang ine-edit, i-clear ang form
            if (editingId === item.id) {
              resetForm();
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Prayer Journal 📓</Text>

          <View style={[styles.inputCard, editingId && styles.inputCardEditing]}>
            <Text style={styles.sectionLabel}>
              {editingId ? '✏ Edit Devotion' : 'Add Permanent Devotion & Picture'}
            </Text>

            <TextInput
              style={styles.smallInput}
              placeholder="Sender's Name (e.g. Pastor John)"
              placeholderTextColor="#64748B"
              value={senderName}
              onChangeText={setSenderName}
            />

            <TextInput
              style={styles.smallInput}
              placeholder="Devotion Title (e.g. Strength & Comfort)"
              placeholderTextColor="#64748B"
              value={devotionTitle}
              onChangeText={setDevotionTitle}
            />

            <TextInput
              style={styles.smallInput}
              placeholder="Bible Passage (e.g. Philippians 4:6-7)"
              placeholderTextColor="#64748B"
              value={biblePassage}
              onChangeText={setBiblePassage}
            />

            <TextInput
              style={styles.input}
              placeholder="Write your reflection or prayer details..."
              placeholderTextColor="#64748B"
              value={devotionText}
              onChangeText={setDevotionText}
              multiline
            />

            {selectedImage && (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeImgBtn}>
                  <Text style={styles.removeImgText}>✕ Remove Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.mediaButtonRow}>
              <TouchableOpacity style={styles.mediaBtn} onPress={takePhotoWithCamera}>
                <Text style={styles.mediaBtnText}>📷 Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mediaBtn} onPress={pickImageFromGallery}>
                <Text style={styles.mediaBtnText}>🖼️ Gallery</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAddRequest}>
              <Text style={styles.addBtnText}>
                {editingId ? '💾 Save Changes' : '+ Post Devotion'}
              </Text>
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity style={styles.cancelEditBtn} onPress={resetForm}>
                <Text style={styles.cancelEditText}>Cancel Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.subHeading}>Saved Devotions & Pictures</Text>

          {requests.map((item) => (
            <View
              key={item.id}
              style={[styles.requestCard, editingId === item.id && styles.requestCardEditing]}
            >
              <Text style={styles.reqTitle}>{item.title}</Text>

              {item.passage ? (
                <Text style={styles.reqPassage}>📖 {item.passage}</Text>
              ) : null}

              <Text style={styles.reqSender}>👤 By: {item.sender}</Text>

              {item.text ? (
                <Text style={styles.reqBodyText}>{item.text}</Text>
              ) : null}

              <Text style={styles.reqSub}>🕒 {item.timestamp} • {item.status}</Text>

              {item.imageUri && (
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              )}

              {/* DELETE & EDIT */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                  <Text style={styles.actionBtnText}>🗑 Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                  <Text style={styles.actionBtnText}>✏ Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 16 },
  backText: { color: '#60A5FA', fontSize: 16, fontWeight: 'bold' },
  scroll: { padding: 16, paddingBottom: 30 },
  title: { color: '#FFF', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  inputCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  inputCardEditing: { borderColor: '#F59E0B', borderWidth: 2 },
  sectionLabel: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  smallInput: { color: '#FFF', backgroundColor: '#0F172A', padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#334155', fontSize: 14 },
  input: { color: '#FFF', backgroundColor: '#0F172A', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#334155', minHeight: 80, textAlignVertical: 'top' },
  mediaButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  mediaBtn: { flex: 1, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mediaBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  addBtn: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  cancelEditBtn: { backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cancelEditText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  previewContainer: { backgroundColor: '#0F172A', borderRadius: 8, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  previewImage: { width: '100%', height: 220, borderRadius: 6, marginBottom: 8 },
  removeImgBtn: { alignSelf: 'center', paddingVertical: 4 },
  removeImgText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  subHeading: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  requestCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  requestCardEditing: { borderColor: '#F59E0B', borderWidth: 2 },
  reqTitle: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  reqPassage: { color: '#34D399', fontSize: 14, fontWeight: '600', marginTop: 4 },
  reqSender: { color: '#38BDF8', fontSize: 13, marginTop: 4, fontWeight: '600' },
  reqBodyText: { color: '#CBD5E1', fontSize: 14, marginTop: 8, lineHeight: 20 },
  reqSub: { color: '#94A3B8', fontSize: 12, marginTop: 10, marginBottom: 8 },
  cardImage: { width: '100%', height: 260, borderRadius: 8, marginTop: 8, backgroundColor: '#000' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  deleteBtn: { backgroundColor: '#7F1D1D', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  editBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});