import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  Image,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { CameraView, Camera } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function AttendanceScreen() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('A-Z');

  const [regularList, setRegularList] = useState([]);
  const [newbieList, setNewbieList] = useState([]);
  const [eventsList, setEventsList] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [birthday, setBirthday] = useState('');
  const [dateFilledOut, setDateFilledOut] = useState(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(new Date());

  const [address, setAddress] = useState('');
  const [cellLeader, setCellLeader] = useState('N/A');
  const [invitedBy, setInvitedBy] = useState('');
  const [photo, setPhoto] = useState(null);

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [scannerModalVisible, setScannerModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);

  const isBirthdayToday = (birthdayStr) => {
    if (!birthdayStr) return false;
    const today = new Date();
    const currentMonth = today.toLocaleString('en-US', { month: 'short' }).toLowerCase();
    const currentDay = today.getDate();

    const lowerDate = birthdayStr.toLowerCase();
    const isThisMonth = lowerDate.includes(currentMonth);
    const isToday = isThisMonth && (
      lowerDate.includes(` ${currentDay},`) || 
      lowerDate.includes(` ${currentDay} `) || 
      lowerDate.endsWith(` ${currentDay}`)
    );
    return isToday;
  };

  const getDisplayAge = (ageStr, birthdayStr) => {
    if (!ageStr) return '';
    const matches = String(ageStr).match(/\d+/);
    if (!matches) return ageStr;

    let baseAge = parseInt(matches[0], 10);
    if (isBirthdayToday(birthdayStr)) {
      baseAge += 1;
    }
    return `${baseAge}`;
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');

      try {
        const savedRegulars = await AsyncStorage.getItem('@regular_list');
        const savedNewbies = await AsyncStorage.getItem('@newbie_list');
        const savedEvents = await AsyncStorage.getItem('@events_list');
        const savedHistory = await AsyncStorage.getItem('@attendance_history');
        const savedDarkMode = await AsyncStorage.getItem('@dark_mode');

        if (savedRegulars !== null) setRegularList(JSON.parse(savedRegulars));
        if (savedNewbies !== null) setNewbieList(JSON.parse(savedNewbies));
        if (savedEvents !== null) setEventsList(JSON.parse(savedEvents));
        if (savedHistory !== null) setAttendanceHistory(JSON.parse(savedHistory));
        if (savedDarkMode !== null) setIsDarkMode(JSON.parse(savedDarkMode));
      } catch (e) {
        console.log("Error loading data", e);
      }
    })();
  }, []);

  const saveDataToStorage = async (regulars, newbies, events, history) => {
    try {
      if (regulars !== null) await AsyncStorage.setItem('@regular_list', JSON.stringify(regulars));
      if (newbies !== null) await AsyncStorage.setItem('@newbie_list', JSON.stringify(newbies));
      if (events !== null) await AsyncStorage.setItem('@events_list', JSON.stringify(events));
      if (history !== null) await AsyncStorage.setItem('@attendance_history', JSON.stringify(history));
    } catch (e) {
      console.log("Error saving to storage", e);
    }
  };

  const recordAttendanceLog = (member) => {
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const newLog = {
      id: Date.now().toString() + Math.random(),
      name: member.name,
      status: member.status,
      sex: member.sex || 'N/A',
      age: getDisplayAge(member.age, member.birthday) || member.age || 'N/A',
      birthday: member.birthday || 'N/A',
      address: member.address || 'N/A',
      leaderOrInvited: member.status === 'Regular' ? (member.cellLeader || 'N/A') : (member.invitedBy || 'N/A'),
      date: currentDate,
      time: currentTime,
      photo: member.photo || null,
    };

    setAttendanceHistory(prevHistory => {
      const updatedHistory = [newLog, ...prevHistory];
      saveDataToStorage(null, null, null, updatedHistory);
      return updatedHistory;
    });
  };

  const handleTakePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setDatePickerVisible(false);
    if (selectedDate) {
      setSelectedDateObj(selectedDate);
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      const formattedDate = selectedDate.toLocaleDateString('en-US', options);
      setBirthday(formattedDate);
    }
  };

  const getNewbieStatusLabel = (countNum) => {
    if (countNum <= 1) return 'First Timer';
    if (countNum === 2) return 'Second Timer';
    if (countNum === 3) return 'Third Timer';
    if (countNum >= 4) return 'Regular';
    return 'First Timer';
  };

  const handleTogglePresentNewbie = (id) => {
    let targetMember = null;
    let promotedMember = null;

    const updatedNewbies = newbieList.map(item => {
      if (item.id === id) {
        const newIsPresent = !item.isPresent;
        let newCountNum = item.presentCountNumber || 0;
        if (newIsPresent) {
          newCountNum = Math.min(4, newCountNum + 1);
        } else {
          newCountNum = Math.max(0, newCountNum - 1);
        }

        const updatedItem = {
          ...item,
          isPresent: newIsPresent,
          presentCountNumber: newCountNum,
          presentCount: `${newCountNum} / 4`,
          status: getNewbieStatusLabel(newCountNum)
        };

        if (newIsPresent) {
          targetMember = updatedItem;
        }

        if (newCountNum >= 4) {
          promotedMember = {
            id: updatedItem.id,
            name: updatedItem.name,
            sex: updatedItem.sex,
            age: updatedItem.age,
            birthday: updatedItem.birthday,
            address: updatedItem.address,
            cellLeader: 'N/A',
            dateFilledOut: updatedItem.dateFilledOut,
            status: 'Regular',
            isPresent: false,
            photo: updatedItem.photo
          };
          return null;
        }
        return updatedItem;
      }
      return item;
    }).filter(Boolean);

    setNewbieList(updatedNewbies);

    let updatedRegulars = regularList;
    if (promotedMember) {
      updatedRegulars = [promotedMember, ...regularList];
      setRegularList(updatedRegulars);
      Alert.alert("Congratulations! 🎉", `${promotedMember.name} has completed 4/4 attendance! Promoted to Regular Member.`);
    }

    if (targetMember) {
      recordAttendanceLog(targetMember);
    }

    saveDataToStorage(updatedRegulars, updatedNewbies, null, null);
  };

  const handleTogglePresentRegular = (id) => {
    let targetMember = null;
    const updatedRegulars = regularList.map(item => {
      if (item.id === id) {
        const nextState = !item.isPresent;
        const updatedItem = { ...item, isPresent: nextState };
        if (nextState) {
          targetMember = updatedItem;
        }
        return updatedItem;
      }
      return item;
    });

    setRegularList(updatedRegulars);
    if (targetMember) {
      recordAttendanceLog(targetMember);
    }
    saveDataToStorage(updatedRegulars, null, null, null);
  };

  const handleBarCodeScanned = ({ data }) => {
    setScannerModalVisible(false);
    let foundMember = null;

    const updatedRegulars = regularList.map(item => {
      if (item.id === data || item.name.toLowerCase() === data.toLowerCase()) {
        foundMember = { ...item, isPresent: true };
        return foundMember;
      }
      return item;
    });

    if (foundMember) {
      setRegularList(updatedRegulars);
      recordAttendanceLog(foundMember);
      saveDataToStorage(updatedRegulars, null, null, null);
      Alert.alert("Success! 🎉", `${foundMember.name} has been marked as Present ✅`);
      return;
    }

    Alert.alert("Not Found", `No matching regular member found for QR Data: "${data}"`);
  };

  const handleDelete = (id, isRegular) => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this record?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            if (isRegular) {
              const updated = regularList.filter(item => item.id !== id);
              setRegularList(updated);
              saveDataToStorage(updated, null, null, null);
            } else {
              const updated = newbieList.filter(item => item.id !== id);
              setNewbieList(updated);
              saveDataToStorage(null, updated, null, null);
            }
          }
        }
      ]
    );
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditId(null);
    setName('');
    setSex('');
    setAge('');
    setBirthday('');
    setDateFilledOut(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    setAddress('');
    setCellLeader('N/A');
    setInvitedBy('');
    setPhoto(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (item, isRegular) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name || '');
    setSex(item.sex || '');
    setAge(item.age || '');
    setBirthday(item.birthday || '');
    setDateFilledOut(item.dateFilledOut || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    setAddress(item.address || '');
    setCellLeader(item.cellLeader || 'N/A');
    setInvitedBy(item.invitedBy || 'N/A');
    setPhoto(item.photo || null);
    setModalVisible(true);
  };

  const handleOpenQR = (item) => {
    setSelectedMember(item);
    setQrModalVisible(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter the Full Name.");
      return;
    }

    const isAddingRegular = activeTab === 'Regular';
    let updatedEvents = [...eventsList];

    if (birthday.trim() !== '') {
      const newEvent = {
        id: Date.now().toString(),
        title: `${name}'s Birthday 🎉`,
        date: birthday
      };
      updatedEvents = [newEvent, ...updatedEvents];
      setEventsList(updatedEvents);
    }

    if (isEditing) {
      if (activeTab === 'Regular') {
        const updatedRegulars = regularList.map(item => 
          item.id === editId ? {
            ...item,
            name,
            sex: sex || 'N/A',
            age: age || 'N/A',
            birthday: birthday || 'N/A',
            dateFilledOut,
            address: address || 'N/A',
            cellLeader: cellLeader || 'N/A',
            photo,
          } : item
        );
        setRegularList(updatedRegulars);
        saveDataToStorage(updatedRegulars, null, updatedEvents, null);
      } else {
        const updatedNewbies = newbieList.map(item => 
          item.id === editId ? {
            ...item,
            name,
            sex: sex || 'N/A',
            age: age || 'N/A',
            birthday: birthday || 'N/A',
            dateFilledOut,
            address: address || 'N/A',
            invitedBy: invitedBy || 'N/A',
            photo,
          } : item
        );
        setNewbieList(updatedNewbies);
        saveDataToStorage(null, updatedNewbies, updatedEvents, null);
      }
      setModalVisible(false);
      Alert.alert("Success", "Successfully updated record!");
    } else {
      if (isAddingRegular) {
        const newItem = {
          id: Date.now().toString(),
          name,
          sex: sex || 'N/A',
          age: age || 'N/A',
          birthday: birthday || 'N/A',
          address: address || 'N/A',
          cellLeader: cellLeader || 'N/A',
          dateFilledOut,
          status: 'Regular',
          isPresent: false,
          photo,
        };
        const updatedRegulars = [newItem, ...regularList];
        setRegularList(updatedRegulars);
        saveDataToStorage(updatedRegulars, null, updatedEvents, null);
      } else {
        const newItem = {
          id: Date.now().toString(),
          name,
          sex: sex || 'N/A',
          age: age || 'N/A',
          birthday: birthday || 'N/A',
          address: address || 'N/A',
          invitedBy: invitedBy || 'N/A',
          dateFilledOut,
          status: 'First Timer',
          presentCountNumber: 0,
          presentCount: '0 / 4',
          isPresent: false,
          photo,
        };
        const updatedNewbies = [newItem, ...newbieList];
        setNewbieList(updatedNewbies);
        saveDataToStorage(null, updatedNewbies, updatedEvents, null);
      }

      setModalVisible(false);
      Alert.alert("Success", "Successfully added record!");
    }
  };

  const handleDirectPrint = async () => {
    try {
      const combined = [...regularList, ...newbieList];
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #1E293B; }
              h2 { text-align: center; margin-bottom: 5px; }
              .summary { text-align: center; margin-bottom: 20px; font-size: 13px; color: #64748B; font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #CBD5E1; padding: 8px 10px; text-align: left; font-size: 12px; }
              th { background-color: #0F172A; color: #FFF; }
              tr:nth-child(even) { background-color: #F8FAFC; }
            </style>
          </head>
          <body>
            <h2>IKONEK - Attendance & Youth Master List</h2>
            <div class="summary">
              Total Regulars: ${regularList.length} | Total Timers/Newbies: ${newbieList.length} | Overall Total: ${combined.length}
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Full Name</th>
                  <th>Status</th>
                  <th>Sex / Age</th>
                  <th>Birthday</th>
                  <th>Address</th>
                  <th>Cell Leader / Invited By</th>
                  <th>Date Filled Out</th>
                </tr>
              </thead>
              <tbody>
                ${combined.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td><b>${item.name}</b></td>
                    <td>${item.status}</td>
                    <td>${item.sex} / ${getDisplayAge(item.age, item.birthday)}</td>
                    <td>${item.birthday}</td>
                    <td>${item.address}</td>
                    <td>${item.status === 'Regular' ? item.cellLeader : item.invitedBy}</td>
                    <td>${item.dateFilledOut}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      Alert.alert("Error", "Unable to print at the moment.");
    }
  };

  let combinedData = [];
  if (activeTab === 'All') {
    combinedData = [...regularList, ...newbieList];
  } else if (activeTab === 'Regular') {
    combinedData = regularList;
  } else if (activeTab === 'First Timer') {
    combinedData = newbieList.filter(item => item.presentCountNumber <= 1);
  } else if (activeTab === 'Second Timer') {
    combinedData = newbieList.filter(item => item.presentCountNumber === 2);
  } else if (activeTab === 'Third Timer') {
    combinedData = newbieList.filter(item => item.presentCountNumber === 3);
  }

  if (searchQuery.trim() !== '') {
    combinedData = combinedData.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  combinedData.sort((a, b) => {
    if (sortOrder === 'A-Z') {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });

  const totalAllCount = regularList.length + newbieList.length;
  const firstTimerCount = newbieList.filter(i => i.presentCountNumber <= 1).length;
  const secondTimerCount = newbieList.filter(i => i.presentCountNumber === 2).length;
  const thirdTimerCount = newbieList.filter(i => i.presentCountNumber === 3).length;

  const theme = {
    bg: isDarkMode ? '#0F172A' : '#F1F5F9',
    cardBg: isDarkMode ? '#1E293B' : '#FFFFFF',
    textMain: isDarkMode ? '#FFF' : '#0F172A',
    textSub: isDarkMode ? '#94A3B8' : '#64748B',
    border: isDarkMode ? '#334155' : '#CBD5E1',
    inputBg: isDarkMode ? '#0F172A' : '#F8FAFC',
    tableAlt: isDarkMode ? '#172033' : '#F1F5F9',
    tableHeader: isDarkMode ? '#0F172A' : '#E2E8F0',
    tableHeaderText: isDarkMode ? '#38BDF8' : '#0369A1'
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* HEADER & THEME TOGGLE ROW */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.textMain }]}>Attendance Tracker</Text>
          <TouchableOpacity 
            style={[styles.themeToggleBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0', borderColor: theme.border }]}
            onPress={() => {
              const newMode = !isDarkMode;
              setIsDarkMode(newMode);
              AsyncStorage.setItem('@dark_mode', JSON.stringify(newMode));
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.textMain }}>
              {isDarkMode ? '☀ Light' : '🌙 Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topControlRow}>
          <TextInput 
            style={[styles.searchInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]} 
            placeholder="🔍 Search name or address..." 
            placeholderTextColor={theme.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <TouchableOpacity 
            style={[styles.iconActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} 
            onPress={() => setSortOrder(sortOrder === 'A-Z' ? 'Z-A' : 'A-Z')}
          >
            <Text style={styles.iconBtnText}>🔤 {sortOrder}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} 
            onPress={() => {
              if (hasCameraPermission === false) {
                Alert.alert("Permission Error", "Camera permission is not granted.");
                return;
              }
              setScannerModalVisible(true);
            }}
          >
            <Text style={styles.iconBtnText}>📷 Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} 
            onPress={handleDirectPrint}
          >
            <Text style={styles.iconBtnText}>🖨 Print</Text>
          </TouchableOpacity>

          {/* HISTORY BUTTON */}
          <TouchableOpacity 
            style={[styles.iconActionBtn, { backgroundColor: '#3B82F6', borderColor: '#2563EB' }]} 
            onPress={() => setHistoryModalVisible(true)}
          >
            <Text style={[styles.iconBtnText, { color: '#FFF' }]}>📋 History</Text>
          </TouchableOpacity>
        </View>

        {/* ADD NEW MEMBER BUTTON */}
        {activeTab !== 'All' && (
          <TouchableOpacity 
            style={styles.addYouthBtn} 
            onPress={handleOpenAdd}
          >
            <Text style={styles.addYouthBtnText}>
              + Add New {activeTab === 'Regular' ? 'Regular' : 'Timer Member'}
            </Text>
          </TouchableOpacity>
        )}

        {/* TABS BUTTONS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollContainer}>
          <View style={[styles.tabContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'All' && styles.activeTabBtn]}
              onPress={() => setActiveTab('All')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'All' ? '#FFF' : theme.textSub }]}>
                All ({totalAllCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'Regular' && styles.activeTabBtn]}
              onPress={() => setActiveTab('Regular')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'Regular' ? '#FFF' : theme.textSub }]}>
                Regular ({regularList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'First Timer' && styles.activeTabBtn]}
              onPress={() => setActiveTab('First Timer')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'First Timer' ? '#FFF' : theme.textSub }]}>
                First Timer ({firstTimerCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'Second Timer' && styles.activeTabBtn]}
              onPress={() => setActiveTab('Second Timer')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'Second Timer' ? '#FFF' : theme.textSub }]}>
                Second Timer ({secondTimerCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'Third Timer' && styles.activeTabBtn]}
              onPress={() => setActiveTab('Third Timer')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'Third Timer' ? '#FFF' : theme.textSub }]}>
                Third Timer ({thirdTimerCount})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {combinedData.length === 0 ? (
          <Text style={[styles.noDataText, { color: theme.textSub }]}>No attendance records found.</Text>
        ) : activeTab === 'All' ? (
          <View style={[styles.tableContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.tableHeaderRow, { backgroundColor: theme.tableHeader, borderBottomColor: theme.border }]}>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, color: theme.tableHeaderText }]}>#</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.8, color: theme.tableHeaderText }]}>Name & Status</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, color: theme.tableHeaderText }]}>Details</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, color: theme.tableHeaderText }]}>Address</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.3, color: theme.tableHeaderText }]}>Leader / Invited</Text>
            </View>
            {combinedData.map((item, index) => {
              const isBday = isBirthdayToday(item.birthday);
              const displayAge = getDisplayAge(item.age, item.birthday);
              return (
                <View key={item.id} style={[styles.tableRow, { borderBottomColor: theme.border }, index % 2 === 1 && { backgroundColor: theme.tableAlt }]}>
                  <Text style={[styles.tableCell, { flex: 0.5, color: theme.textSub }]}>{index + 1}</Text>
                  
                  <View style={{ flex: 1.8, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.tableCell, { fontWeight: 'bold', color: theme.textMain }]}>{item.name}</Text>
                      {isBday && <Text style={{ fontSize: 12 }}>🎂</Text>}
                    </View>
                    <Text style={{ fontSize: 9, color: item.status === 'Regular' ? '#34D399' : '#F59E0B', marginTop: 1 }}>
                      {item.status}
                    </Text>
                  </View>

                  <View style={{ flex: 1.2, justifyContent: 'center' }}>
                    <Text style={[styles.tableCell, { fontSize: 9, color: theme.textMain }]}>{item.sex} • {displayAge}</Text>
                    <Text style={[styles.tableCell, { fontSize: 8, color: isBday ? '#FACC15' : theme.textSub, fontWeight: isBday ? 'bold' : 'normal' }]}>
                      {item.birthday} {isBday ? '🎂' : ''}
                    </Text>
                  </View>

                  <View style={{ flex: 1.2, justifyContent: 'center' }}>
                    <Text style={[styles.tableCell, { fontSize: 10, color: theme.textMain }]}>{item.address}</Text>
                  </View>

                  <View style={{ flex: 1.3, justifyContent: 'center' }}>
                    <Text style={[styles.tableCell, { fontSize: 10, color: '#38BDF8' }]}>
                      {item.status === 'Regular' ? item.cellLeader : item.invitedBy}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          combinedData.map((item) => {
            const isRegular = item.status === 'Regular';
            const isBday = isBirthdayToday(item.birthday);
            const displayAge = getDisplayAge(item.age, item.birthday);
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: isBday ? '#FACC15' : theme.border, borderWidth: isBday ? 2 : 1 }]}>
                <View style={styles.cardTopRow}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                      <Text style={[styles.avatarText, { color: theme.textMain }]}>{item.name.charAt(0)}</Text>
                    </View>
                  )}

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.nameAndDate}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.nameText, { color: theme.textMain }]}>{item.name}</Text>
                        {isBday && (
                          <View style={styles.bdayBadge}>
                            <Text style={styles.bdayBadgeText}>🎂 {item.birthday}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.dateText, { color: theme.textSub }]}>Filled: {item.dateFilledOut}</Text>
                    </View>
                    <Text style={[styles.infoText, { color: theme.textSub }]}>
                      {item.sex} • {displayAge} • <Text style={{ color: isBday ? '#FACC15' : theme.textSub, fontWeight: isBday ? 'bold' : 'normal' }}>B-Day: {item.birthday} {isBday ? '🎉' : ''}</Text>
                    </Text>
                    <Text style={[styles.infoText, { color: theme.textSub }]}>Address: {item.address}</Text>
                    <Text style={[styles.infoText, { color: theme.textSub }]}>
                      {isRegular ? `Cell Leader: ${item.cellLeader}` : `Invited by: ${item.invitedBy}`}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusRow, { borderBottomColor: theme.border }]}>
                  {!isRegular ? (
                    <Text style={styles.countText}>Present Count: {item.presentCount}</Text>
                  ) : (
                    <Text style={styles.countTextRegular}>
                      {item.isPresent ? "Status: Present ✅" : "Status: Not Marked"}
                    </Text>
                  )}
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {isRegular && (
                      <TouchableOpacity 
                        style={styles.qrBtnInline} 
                        onPress={() => handleOpenQR(item)}
                      >
                        <Text style={styles.qrBtnText}>📱 View QR</Text>
                      </TouchableOpacity>
                    )}

                    <View style={[styles.badge, isRegular ? styles.regularBadge : styles.newbieBadge]}>
                      <Text style={[styles.badgeText, isRegular ? styles.regularBadgeText : styles.newbieBadgeText]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => handleDelete(item.id, isRegular)}
                  >
                    <Text style={styles.btnText}>🗑 Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.editBtn} 
                    onPress={() => handleOpenEdit(item, isRegular)}
                  >
                    <Text style={styles.btnText}>✏ Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.presentBtn, item.isPresent && styles.activePresentBtn]} 
                    onPress={() => {
                      if (!isRegular) {
                        handleTogglePresentNewbie(item.id);
                      } else {
                        handleTogglePresentRegular(item.id);
                      }
                    }}
                  >
                    <Text style={styles.btnText}>
                      {item.isPresent ? "✅ Present" : "Mark Present"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* ADD/EDIT MODAL */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>
                {isEditing ? 'Edit Record' : `Add New ${activeTab === 'Regular' ? 'Regular' : 'Timer'} Member`}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalPhotoContainer}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.modalAvatarImage} />
                  ) : (
                    <View style={[styles.modalAvatarPlaceholder, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <Text style={{ fontSize: 24 }}>📷</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={styles.photoActionBtn} onPress={handleTakePhoto}>
                      <Text style={styles.photoActionText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickFromGallery}>
                      <Text style={styles.photoActionText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Full Name *</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor={theme.textSub}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Sex</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. Male / Female"
                  placeholderTextColor={theme.textSub}
                  value={sex}
                  onChangeText={setSex}
                />

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Age</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. 21"
                  placeholderTextColor={theme.textSub}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Birthday</Text>
                <TouchableOpacity
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, justifyContent: 'center' }]}
                  onPress={() => setDatePickerVisible(true)}
                >
                  <Text style={{ color: birthday ? theme.textMain : theme.textSub }}>
                    {birthday || 'Select Birthday (Tap here)'}
                  </Text>
                </TouchableOpacity>

                {datePickerVisible && (
                  <DateTimePicker
                    value={selectedDateObj}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                  />
                )}

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Address</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. Masbate City"
                  placeholderTextColor={theme.textSub}
                  value={address}
                  onChangeText={setAddress}
                />

                {activeTab === 'Regular' ? (
                  <>
                    <Text style={[styles.inputLabel, { color: theme.textSub }]}>Cell Leader</Text>
                    <TextInput
                      style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                      placeholder="e.g. Pastor John"
                      placeholderTextColor={theme.textSub}
                      value={cellLeader}
                      onChangeText={setCellLeader}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.inputLabel, { color: theme.textSub }]}>Invited By</Text>
                    <TextInput
                      style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                      placeholder="e.g. Mary Doe"
                      placeholderTextColor={theme.textSub}
                      value={invitedBy}
                      onChangeText={setInvitedBy}
                    />
                  </>
                )}

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: theme.border }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
                    <Text style={styles.modalSaveText}>Save Record</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* QR CODE MODAL */}
        <Modal
          visible={qrModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setQrModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg, alignItems: 'center' }]}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>Member QR Code</Text>
              <Text style={[styles.infoText, { color: theme.textSub, marginBottom: 20 }]}>
                {selectedMember?.name}
              </Text>

              {selectedMember && (
                <View style={{ padding: 15, backgroundColor: '#FFF', borderRadius: 10, marginBottom: 20 }}>
                  <QRCode value={selectedMember.id} size={180} />
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: '#3B82F6', width: '100%' }]}
                onPress={() => setQrModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: '#FFF' }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ATTENDANCE HISTORY MODAL */}
        <Modal
          visible={historyModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setHistoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg, height: '85%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.modalTitle, { color: theme.textMain, marginBottom: 0 }]}>📋 Attendance Logs History</Text>
                <TouchableOpacity onPress={() => {
                  Alert.alert("Clear History", "Are you sure you want to clear all attendance logs?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: () => {
                      setAttendanceHistory([]);
                      AsyncStorage.removeItem('@attendance_history');
                    }}
                  ]);
                }}>
                  <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 12 }}>Clear All</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 11, color: theme.textSub, marginBottom: 10 }}>
                All present marks or scans from the tabs are automatically saved here along with complete member records.
              </Text>

              {attendanceHistory.length === 0 ? (
                <Text style={[styles.noDataText, { color: theme.textSub, marginTop: 60 }]}>No attendance logs recorded yet.</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {attendanceHistory.map((log) => (
                    <View key={log.id} style={[styles.historyItemCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        {log.photo ? (
                          <Image source={{ uri: log.photo }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                        ) : (
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{log.name.charAt(0)}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 13, color: theme.textMain }}>{log.name}</Text>
                          <Text style={{ fontSize: 10, color: '#38BDF8', marginTop: 1 }}>
                            Status: {log.status} • {log.sex} • Age: {log.age}
                          </Text>
                          <Text style={{ fontSize: 9, color: theme.textSub, marginTop: 1 }}>
                            Birthday: {log.birthday} | Address: {log.address}
                          </Text>
                          <Text style={{ fontSize: 9, color: '#F59E0B', marginTop: 1 }}>
                            Leader/Invited: {log.leaderOrInvited}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.textMain }}>{log.date}</Text>
                        <Text style={{ fontSize: 9, color: theme.textSub, marginTop: 2 }}>{log.time}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: '#3B82F6', width: '100%', marginTop: 15, alignItems: 'center' }]}
                onPress={() => setHistoryModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: '#FFF' }]}>Close History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* CAMERA SCANNER MODAL */}
        <Modal
          visible={scannerModalVisible}
          animationType="slide"
          onRequestClose={() => setScannerModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <CameraView
              style={{ flex: 1 }}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            >
              <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', margin: 20 }}>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 20 }}>
                  Align QR code within the frame to scan
                </Text>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { backgroundColor: '#EF4444', alignSelf: 'center', width: 150, marginBottom: 20 }]}
                  onPress={() => setScannerModalVisible(false)}
                >
                  <Text style={[styles.modalCancelText, { color: '#FFF' }]}>Cancel Scan</Text>
                </TouchableOpacity>
              </SafeAreaView>
            </CameraView>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  themeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  topControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 2,
    minWidth: '100%',
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  iconActionBtn: {
    flex: 1,
    minWidth: '22%',
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addYouthBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  addYouthBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabScrollContainer: {
    marginBottom: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeTabBtn: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  tableContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 11,
  },
  card: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  nameAndDate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 10,
  },
  infoText: {
    fontSize: 11,
    marginTop: 2,
  },
  bdayBadge: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bdayBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#854D0E',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  countText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  countTextRegular: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#34D399',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  regularBadge: {
    backgroundColor: '#065F46',
  },
  newbieBadge: {
    backgroundColor: '#78350F',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  regularBadgeText: {
    backgroundColor: '#6EE7B7',
    color: '#065F46',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  newbieBadgeText: {
    backgroundColor: '#FCD34D',
    color: '#78350F',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  qrBtnInline: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qrBtnText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  deleteBtn: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtn: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  presentBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activePresentBtn: {
    backgroundColor: '#059669',
  },
  btnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 12,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalPhotoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
  },
  modalAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoActionBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoActionText: {
    color: '#FFF',
    fontSize: 11,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputField: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    fontSize: 13,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: 'bold',
  },
  modalSaveBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  historyItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'center',
  },
})