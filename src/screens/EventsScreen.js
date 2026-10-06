import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  SafeAreaView
} from 'react-native';
import * as Print from 'expo-print';

// Para hindi masira ang PDF kung may special characters (<, >, &) ang tinype
const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export default function EventsScreen() {
  const [events, setEvents] = useState([
    {
      id: '1',
      title: 'IKONEK CELEBRATION',
      category: 'Upcoming',
      date: 'Sat, Oct 12, 2026 • 6:00 PM - 8:30 PM',
      location: 'Main Sanctuary',
      month: 'October',
      flowOfProgram: '6:00 PM - Opening Prayer & Worship\n6:45 PM - Games & Ice Breakers\n7:15 PM - Message / Word of God\n8:00 PM - Fellowship & Snacks',
      signedUp: ['John Doe', 'Maria Santos', 'Mark Joshua'],
      reminderSet: false,
    },
    {
      id: '2',
      title: 'IKONEK CELEBRATION',
      category: 'Special',
      date: 'Sat, Oct 26, 2026 • 8:00 AM - 12:00 PM',
      location: 'Nursery Masbate City',
      month: 'October',
      flowOfProgram: '8:00 AM - Assembly & Briefing\n8:30 AM - Feeding Program\n10:00 AM - Gift Giving & Sharing\n11:30 AM - Closing Remarks',
      signedUp: ['Pastor Alex', 'Sarah Jenkins'],
      reminderSet: false,
    },
    {
      id: '3',
      title: 'IKONEK CELEBRATION',
      category: 'Annual',
      date: 'Nov 15 - 17, 2026 • Whole Day',
      location: 'Camp Center',
      month: 'November',
      flowOfProgram: 'Day 1: Arrival & Opening Worship\nDay 2: Morning Devotion & Workshop\nDay 3: Dedication & Departure',
      signedUp: ['Worship Team', 'Youth Leaders'],
      reminderSet: false,
    },
  ]);

  const [selectedMonth, setSelectedMonth] = useState('All');

  // States para sa Details Modal (Flow & Attendees)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // States para sa Edit Event Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editFlow, setEditFlow] = useState('');
  const [editMonth, setEditMonth] = useState('October');
  const [editCategory, setEditCategory] = useState('Upcoming');

  // States para sa Add Event Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newFlow, setNewFlow] = useState('');
  const [newMonth, setNewMonth] = useState('October');
  const [newCategory, setNewCategory] = useState('Upcoming');

  // Function para i-toggle ang Reminder
  const handleToggleReminder = (id) => {
    setEvents(events.map(ev => {
      if (ev.id === id) {
        const newStatus = !ev.reminderSet;
        Alert.alert(
          newStatus ? "Reminder Set" : "Reminder Removed",
          newStatus ? `You will be reminded for "${ev.title}".` : `Reminder cancelled for "${ev.title}".`
        );
        return { ...ev, reminderSet: newStatus };
      }
      return ev;
    }));
  };

  // Buksan ang Details Modal
  const handleOpenDetails = (event) => {
    setSelectedEvent(event);
    setModalVisible(true);
  };

  // Buksan ang Edit Modal
  const handleOpenEdit = (event) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDate(event.date);
    setEditLocation(event.location);
    setEditFlow(event.flowOfProgram);
    setEditMonth(event.month);
    setEditCategory(event.category);
    setEditModalVisible(true);
  };

  // I-save ang na-edit na event
  const handleSaveEdit = () => {
    if (!editTitle.trim() || !editDate.trim()) {
      Alert.alert("Error", "Title and Date cannot be empty.");
      return;
    }

    setEvents(events.map(ev => {
      if (ev.id === editingEvent.id) {
        return {
          ...ev,
          title: editTitle,
          date: editDate,
          location: editLocation,
          flowOfProgram: editFlow,
          month: editMonth,
          category: editCategory
        };
      }
      return ev;
    }));

    setEditModalVisible(false);
    Alert.alert("Success", "Event successfully updated!");
  };

  // Function para i-add ang bagong event
  const handleAddEvent = () => {
    if (!newTitle.trim() || !newDate.trim()) {
      Alert.alert("Error", "Please enter Event Title and Date.");
      return;
    }

    const newEventObj = {
      id: Date.now().toString(),
      title: newTitle,
      category: newCategory,
      date: newDate,
      location: newLocation || 'Main Church',
      month: newMonth,
      flowOfProgram: newFlow || 'No flow of program provided yet.',
      signedUp: [],
      reminderSet: false,
    };

    setEvents([newEventObj, ...events]);
    setAddModalVisible(false);

    // Clear inputs
    setNewTitle('');
    setNewDate('');
    setNewLocation('');
    setNewFlow('');

    Alert.alert("Success", "New event successfully added!");
  };

  // 🗑 DELETE: may kumpirmasyon muna bago tuluyang tanggalin ang event
  const handleDeleteEvent = (event) => {
    Alert.alert(
      "Delete Event",
      `Are you sure you want to delete "${event.title}" (${event.date})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setEvents(prev => prev.filter(ev => ev.id !== event.id));
            // Isara ang mga modal kung ito ang kasalukuyang nakabukas
            if (selectedEvent && selectedEvent.id === event.id) {
              setModalVisible(false);
              setSelectedEvent(null);
            }
            if (editingEvent && editingEvent.id === event.id) {
              setEditModalVisible(false);
              setEditingEvent(null);
            }
          }
        }
      ]
    );
  };

  // 🖨️ AUTOMATIC PRINT (PDF): gagawa ng PDF ng Flow of Program at bubuksan agad
  // ang print screen. Dito pwede mong i-print o i-"Save as PDF".
  const handlePrintFlow = async (event) => {
    try {
      const flowLines = String(event.flowOfProgram || '')
        .split('\n')
        .filter(line => line.trim() !== '');

      const flowHtml = flowLines.length > 0
        ? flowLines.map((line, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>${escapeHtml(line)}</td>
            </tr>
          `).join('')
        : `<tr><td colspan="2" class="empty">No flow of program provided yet.</td></tr>`;

      const attendees = event.signedUp || [];
      const attendeesHtml = attendees.length > 0
        ? attendees.map((name, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>${escapeHtml(name)}</td>
            </tr>
          `).join('')
        : `<tr><td colspan="2" class="empty">No one has signed yet.</td></tr>`;

      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 28px; color: #1E293B; }
              h1 { text-align: center; margin: 0 0 4px 0; font-size: 22px; }
              .subtitle { text-align: center; font-size: 12px; color: #64748B; margin-bottom: 20px; font-weight: bold; }
              .details { border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; font-size: 13px; line-height: 1.7; }
              .details b { display: inline-block; width: 90px; color: #0F172A; }
              h3 { margin: 18px 0 6px 0; font-size: 15px; color: #0369A1; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #CBD5E1; padding: 8px 10px; text-align: left; font-size: 13px; }
              th { background-color: #0F172A; color: #FFF; }
              td.num { width: 36px; text-align: center; color: #64748B; }
              td.empty { text-align: center; color: #64748B; }
              tr:nth-child(even) { background-color: #F8FAFC; }
              .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #94A3B8; }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(event.title)}</h1>
            <div class="subtitle">CHURCH EVENT PROGRAM</div>

            <div class="details">
              <div><b>Category:</b> ${escapeHtml(event.category)}</div>
              <div><b>Date &amp; Time:</b> ${escapeHtml(event.date)}</div>
              <div><b>Location:</b> ${escapeHtml(event.location)}</div>
            </div>

            <h3>Flow of Program</h3>
            <table>
              <thead><tr><th>#</th><th>Program</th></tr></thead>
              <tbody>${flowHtml}</tbody>
            </table>

            <h3>Signed (${attendees.length})</h3>
            <table>
              <thead><tr><th>#</th><th>Name</th></tr></thead>
              <tbody>${attendeesHtml}</tbody>
            </table>

            <div class="footer">IKONEK - Printed on ${escapeHtml(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</div>
          </body>
        </html>
      `;

      // Bubukas agad ang print / Save as PDF screen
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      Alert.alert("Error", "Failed to print the program flow.");
    }
  };

  const filteredEvents = selectedMonth === 'All'
    ? events
    : events.filter(ev => ev.month.toLowerCase() === selectedMonth.toLowerCase());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* Header & Add Event Button Row */}
        <View style={styles.topHeaderRow}>
          <Text style={styles.headerTitle}>Church Events 🎉</Text>
          <TouchableOpacity
            style={styles.addEventTopBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.addEventTopBtnText}>+ Add Event</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Buttons bawat buwan */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {['All', 'October', 'November', 'December'].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.filterBtn, selectedMonth === m && styles.activeFilterBtn]}
              onPress={() => setSelectedMonth(m)}
            >
              <Text style={[styles.filterText, selectedMonth === m && styles.activeFilterText]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Listahan ng Events */}
        {filteredEvents.length === 0 ? (
          <Text style={styles.noEventText}>No events found for {selectedMonth}.</Text>
        ) : (
          filteredEvents.map((item) => (
            <View key={item.id} style={styles.eventCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.category}</Text>
                </View>
              </View>

              <Text style={styles.eventDetail}>🕒 {item.date}</Text>
              <Text style={styles.eventDetail}>📍 {item.location}</Text>

              {/* Action Buttons Container */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.reminderBtn, item.reminderSet && styles.activeReminderBtn]}
                  onPress={() => handleToggleReminder(item.id)}
                >
                  <Text style={styles.reminderBtnText}>
                    {item.reminderSet ? "🔔 Reminder" : "🔔 Set"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => handleOpenDetails(item)}
                >
                  <Text style={styles.btnTextSmall}>📋 Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.printBtn}
                  onPress={() => handlePrintFlow(item)}
                >
                  <Text style={styles.btnTextSmall}>🖨️ Print PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => handleOpenEdit(item)}
                >
                  <Text style={styles.btnTextSmall}>✏️ Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteEvent(item)}
                >
                  <Text style={styles.btnTextSmall}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

      </ScrollView>

      {/* MODAL PARA SA FLOW OF PROGRAM AT ATTENDEES */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEvent && (
              <>
                <Text style={styles.modalTitle}>{selectedEvent.title}</Text>

                <Text style={styles.sectionHeader}>📜 Flow of Program:</Text>
                <View style={styles.boxContent}>
                  <Text style={styles.boxText}>{selectedEvent.flowOfProgram}</Text>
                </View>

                <Text style={styles.sectionHeader}>👥 Signed ({selectedEvent.signedUp.length}):</Text>
                <View style={styles.boxContent}>
                  {selectedEvent.signedUp.length > 0 ? (
                    selectedEvent.signedUp.map((name, index) => (
                      <Text key={index} style={styles.boxText}>• {name}</Text>
                    ))
                  ) : (
                    <Text style={styles.boxText}>No one has signed yet.</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.printModalBtn}
                  onPress={() => handlePrintFlow(selectedEvent)}
                >
                  <Text style={styles.btnText}>🖨️ Print PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { backgroundColor: '#B91C1C' }]}
                  onPress={() => handleDeleteEvent(selectedEvent)}
                >
                  <Text style={styles.btnText}>🗑 Delete Event</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.btnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL PARA SA ADD EVENT */}
      <Modal
        visible={addModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Event</Text>

            <Text style={styles.label}>Event Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. IKONEK CELEBRATION"
              placeholderTextColor="#64748B"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.label}>Date & Time</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sat, Dec 10 • 5:00 PM"
              placeholderTextColor="#64748B"
              value={newDate}
              onChangeText={setNewDate}
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Main Sanctuary"
              placeholderTextColor="#64748B"
              value={newLocation}
              onChangeText={setNewLocation}
            />

            <Text style={styles.label}>Month (October / November / December)</Text>
            <TextInput
              style={styles.input}
              placeholder="October"
              placeholderTextColor="#64748B"
              value={newMonth}
              onChangeText={setNewMonth}
            />

            <Text style={styles.label}>Flow of Program</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              multiline
              placeholder="Enter program flow..."
              placeholderTextColor="#64748B"
              value={newFlow}
              onChangeText={setNewFlow}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#334155' }]}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#2563EB' }]}
                onPress={handleAddEvent}
              >
                <Text style={styles.btnText}>Save Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA SA EDIT EVENT */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Event</Text>

            <Text style={styles.label}>Event Title</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <Text style={styles.label}>Date & Time</Text>
            <TextInput
              style={styles.input}
              value={editDate}
              onChangeText={setEditDate}
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={editLocation}
              onChangeText={setEditLocation}
            />

            <Text style={styles.label}>Month</Text>
            <TextInput
              style={styles.input}
              value={editMonth}
              onChangeText={setEditMonth}
            />

            <Text style={styles.label}>Flow of Program</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              multiline
              value={editFlow}
              onChangeText={setEditFlow}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#334155' }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#2563EB' }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.btnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  scrollContainer: { padding: 20 },
  topHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  addEventTopBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addEventTopBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  filterContainer: { flexDirection: 'row', marginBottom: 20 },
  filterBtn: { backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  activeFilterBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { color: '#94A3B8', fontWeight: '600' },
  activeFilterText: { color: '#FFF' },
  noEventText: { color: '#94A3B8', textAlign: 'center', marginTop: 40 },
  eventCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', flex: 1 },
  badge: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  badgeText: { color: '#38BDF8', fontSize: 12, fontWeight: '600' },
  eventDetail: { color: '#94A3B8', fontSize: 13, marginBottom: 4 },
  actionRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between', gap: 4 },
  reminderBtn: { flex: 1, backgroundColor: '#0284C7', paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  activeReminderBtn: { backgroundColor: '#059669' },
  reminderBtnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  detailsBtn: { flex: 1, backgroundColor: '#475569', paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  printBtn: { flex: 1, backgroundColor: '#0D9488', paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  editBtn: { flex: 1, backgroundColor: '#D97706', paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flex: 1, backgroundColor: '#B91C1C', paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  btnTextSmall: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E293B', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 12 },
  sectionHeader: { color: '#38BDF8', fontSize: 13, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  boxContent: { backgroundColor: '#0F172A', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  boxText: { color: '#CBD5E1', fontSize: 12, lineHeight: 16 },
  printModalBtn: { backgroundColor: '#0D9488', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  closeModalBtn: { backgroundColor: '#334155', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  label: { color: '#FFF', fontSize: 12, fontWeight: '600', marginBottom: 2, marginTop: 6 },
  input: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 8, color: '#FFF', fontSize: 12 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10 },
  modalActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 }
});