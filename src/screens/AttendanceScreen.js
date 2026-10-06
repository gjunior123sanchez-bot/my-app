import React, { useState, useEffect, useRef } from 'react';
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

// Alisin ang doble sa History: iisa lang ang pangalan kada petsa (yung pinakabago ang tinitira)
const dedupeHistory = (list) => {
  const seen = new Set();
  return list.filter(log => {
    const key = `${(log.name || '').trim().toLowerCase()}|${log.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function AttendanceScreen() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('A-Z');

  const [regularList, setRegularList] = useState([]);
  const [newbieList, setNewbieList] = useState([]);
  const [eventsList, setEventsList] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');

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

  // Lock para isang scan = isang check lang (iwas double-scan)
  const scanLockRef = useRef(false);

  // LEADERS
  const [leadersList, setLeadersList] = useState([]);
  const [leadersModalVisible, setLeadersModalVisible] = useState(false);
  const [leaderFormVisible, setLeaderFormVisible] = useState(false);
  const [editLeaderId, setEditLeaderId] = useState(null);
  const [lName, setLName] = useState('');
  const [lSex, setLSex] = useState('');
  const [lAge, setLAge] = useState('');
  const [lBirthday, setLBirthday] = useState('');
  const [lAddress, setLAddress] = useState('');
  const [lContact, setLContact] = useState('');
  const [leaderDatePickerVisible, setLeaderDatePickerVisible] = useState(false);
  const [lSelectedDate, setLSelectedDate] = useState(new Date());

  const [leaderSearch, setLeaderSearch] = useState('');
  const [expandedLeaders, setExpandedLeaders] = useState({}); // { [leaderId]: true/false }

  // Para sa pag-add/edit ng member galing sa Leaders screen
  const [formForceRegular, setFormForceRegular] = useState(false);
  const [returnToLeaders, setReturnToLeaders] = useState(false);

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

  // Petsa ngayong araw (parehong format ng History logs)
  const getTodayDateStr = () =>
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // LOAD DATA pag binuksan ang app
  useEffect(() => {
    (async () => {
      // I-load muna ang naka-save na data (leaders, members, history) bago ang camera permission,
      // para hindi mawala ang data kahit pumalya ang permission request.
      try {
        const savedRegulars = await AsyncStorage.getItem('@regular_list');
        const savedNewbies = await AsyncStorage.getItem('@newbie_list');
        const savedEvents = await AsyncStorage.getItem('@events_list');
        const savedHistory = await AsyncStorage.getItem('@attendance_history');
        const savedDarkMode = await AsyncStorage.getItem('@dark_mode');

        if (savedRegulars !== null) setRegularList(JSON.parse(savedRegulars));
        if (savedNewbies !== null) {
          let newbies = JSON.parse(savedNewbies);

          // ONE-TIME FIX: lahat ng nasa Second Timer ngayon ay ibabalik sa First Timer
          // (1 / 4) at naka-check na (✅ Present) sa All list. Isang beses lang tatakbo.
          const fixDone = await AsyncStorage.getItem('@fix_second_to_first_v1');
          if (fixDone === null) {
            let movedCount = 0;
            newbies = newbies.map(n => {
              if (n.presentCountNumber === 2) {
                movedCount += 1;
                return {
                  ...n,
                  presentCountNumber: 1,
                  presentCount: '1 / 4',
                  status: 'First Timer',
                  isPresent: true,
                };
              }
              return n;
            });
            await AsyncStorage.setItem('@newbie_list', JSON.stringify(newbies));
            await AsyncStorage.setItem('@fix_second_to_first_v1', 'done');
            if (movedCount > 0) {
              Alert.alert("Fixed ✅", `${movedCount} member(s) na dating Second Timer ay ibinalik sa First Timer at naka-check na sa All list.`);
            }
          }

          // ONE-TIME FIX #2: lahat ng nasa First Timer ay magsisimula sa 0 / 4.
          // (Hindi gagalawin ang Second/Third Timer, at hindi rin ang ✅ Present nila.)
          const zeroFixDone = await AsyncStorage.getItem('@fix_first_timer_zero_v1');
          if (zeroFixDone === null) {
            let resetCount = 0;
            newbies = newbies.map(n => {
              if ((n.presentCountNumber || 0) <= 1) {
                resetCount += 1;
                return {
                  ...n,
                  presentCountNumber: 0,
                  presentCount: '0 / 4',
                  status: 'First Timer',
                };
              }
              return n;
            });
            await AsyncStorage.setItem('@newbie_list', JSON.stringify(newbies));
            await AsyncStorage.setItem('@fix_first_timer_zero_v1', 'done');
            if (resetCount > 0) {
              Alert.alert("Reset ✅", `${resetCount} First Timer(s) ay nasa 0 / 4 na.`);
            }
          }

          setNewbieList(newbies);
        }

        if (savedEvents !== null) setEventsList(JSON.parse(savedEvents));

        const savedLeaders = await AsyncStorage.getItem('@leaders_list');
        if (savedLeaders !== null) setLeadersList(JSON.parse(savedLeaders));
        if (savedHistory !== null) {
          const parsed = JSON.parse(savedHistory);
          const cleaned = dedupeHistory(parsed);
          setAttendanceHistory(cleaned);
          if (cleaned.length !== parsed.length) {
            await AsyncStorage.setItem('@attendance_history', JSON.stringify(cleaned));
          }
        }
        if (savedDarkMode !== null) setIsDarkMode(JSON.parse(savedDarkMode));
      } catch (e) {
        console.log("Error loading data", e);
      }

      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(status === 'granted');
      } catch (e) {
        console.log("Camera permission error", e);
        setHasCameraPermission(false);
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

  const buildAttendanceLog = (member) => {
    const currentDate = getTodayDateStr();
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return {
      id: Date.now().toString() + Math.random(),
      memberId: member.id,
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
  };

  // Pagkatapos ng print: lahat ng Present sa All list ay mapupunta sa History,
  // tapos ma-clear ang Present sa All list para ready na sa susunod na attendance.
  const archiveAndClearAttendance = () => {
    const presentMembers = [...regularList, ...newbieList].filter(m => m.isPresent);
    if (presentMembers.length === 0) return;

    const newLogs = presentMembers.map(buildAttendanceLog);
    const updatedHistory = dedupeHistory([...newLogs, ...attendanceHistory]);
    const updatedRegulars = regularList.map(r => ({ ...r, isPresent: false }));
    const updatedNewbies = newbieList.map(n => ({ ...n, isPresent: false }));

    setAttendanceHistory(updatedHistory);
    setRegularList(updatedRegulars);
    setNewbieList(updatedNewbies);
    saveDataToStorage(updatedRegulars, updatedNewbies, null, updatedHistory);

    Alert.alert("Saved to History ✅", `${newLogs.length} attendance record(s) moved to History. Ready for the next attendance.`);
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

  // TIMERS: bawat tap sa Present = dagdag 1 sa count (2/4 -> 3/4 -> 4/4).
  // Awtomatikong lilipat sa susunod na tab (Second -> Third Timer), at Regular pag 4/4.
  const handleTogglePresentNewbie = (id) => {
    let promotedMember = null;

    const updatedNewbies = newbieList.map(item => {
      if (item.id === id) {
        const newIsPresent = true;
        const newCountNum = Math.min(4, (item.presentCountNumber || 0) + 1);

        const updatedItem = {
          ...item,
          isPresent: newIsPresent,
          presentCountNumber: newCountNum,
          presentCount: `${newCountNum} / 4`,
          status: getNewbieStatusLabel(newCountNum)
        };

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
            isPresent: true,
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

    saveDataToStorage(updatedRegulars, updatedNewbies, null, null);
  };

  // REGULAR: tap Mark Present -> automatic na naka-check (✅ Present) sa All list.
  // Walang magbabago sa Regular tab. Mare-reset ito pagkatapos i-print ang All list.
  const handleMarkPresentRegular = (id) => {
    const member = regularList.find(item => item.id === id);
    if (!member) return;

    if (member.isPresent) {
      Alert.alert("Already Present", `${member.name} is already marked Present in the All list.`);
      return;
    }

    const updatedRegulars = regularList.map(item =>
      item.id === id ? { ...item, isPresent: true } : item
    );
    setRegularList(updatedRegulars);
    saveDataToStorage(updatedRegulars, null, null, null);
    Alert.alert("Present ✅", `${member.name} has been marked Present in the All list.`);
  };

  // ALL LIST: tap ang ✅ Present para i-uncheck.
  // Regular: Present lang ang matatanggal. Timer: babalik din ang count ng -1 (hal. 3/4 -> 2/4).
  const handleUncheckPresent = (item) => {
    if (item.status === 'Regular') {
      const updatedRegulars = regularList.map(r =>
        r.id === item.id ? { ...r, isPresent: false } : r
      );
      setRegularList(updatedRegulars);
      saveDataToStorage(updatedRegulars, null, null, null);
    } else {
      const updatedNewbies = newbieList.map(n => {
        if (n.id !== item.id) return n;
        const newCount = Math.max(0, (n.presentCountNumber || 0) - 1);
        return {
          ...n,
          isPresent: false,
          presentCountNumber: newCount,
          presentCount: `${newCount} / 4`,
          status: getNewbieStatusLabel(newCount)
        };
      });
      setNewbieList(updatedNewbies);
      saveDataToStorage(null, updatedNewbies, null, null);
    }
  };

  // UNDO (Timers): ibabalik ang namali na Mark Present.
  // Babawas ng 1 sa count (hal. 3/4 -> 2/4) at otomatikong babalik sa tamang tab
  // (Third Timer -> Second Timer, atbp.). Naka-uncheck na rin siya sa All list.
  const handleUndoNewbiePresent = (item) => {
    Alert.alert(
      "Undo Present",
      `Ibabalik si ${item.name} sa ${Math.max(0, (item.presentCountNumber || 0) - 1)} / 4. Tuloy?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Undo", style: "destructive", onPress: () => handleUncheckPresent(item) }
      ]
    );
  };

  // QR SCAN: Regular members LANG na may QR code ang awtomatikong mate-check.
  // Hindi apektado ang First / Second / Third Timer (walang madadagdag na bilang).
  const handleBarCodeScanned = ({ data }) => {
    if (scanLockRef.current) return; // iwas double-scan
    scanLockRef.current = true;
    setScannerModalVisible(false);

    const scanned = String(data).trim();
    const regular = regularList.find(item => item.id === scanned);

    if (regular) {
      if (regular.isPresent) {
        Alert.alert("Already Present", `${regular.name} is already marked Present.`);
        return;
      }
      const updatedRegulars = regularList.map(item =>
        item.id === regular.id ? { ...item, isPresent: true } : item
      );
      setRegularList(updatedRegulars);
      saveDataToStorage(updatedRegulars, null, null, null);
      Alert.alert("Success! 🎉", `${regular.name} has been marked as Present ✅`);
      return;
    }

    // Kung timer ang na-scan, wala siyang gagalawin
    if (newbieList.some(n => n.id === scanned)) {
      Alert.alert(
        "Timer Member",
        "Regular members with QR code lang ang pwedeng i-scan. Para sa Timers, gamitin ang Present button."
      );
      return;
    }

    Alert.alert("Not Found", "Walang Regular member na tugma sa QR code na ito.");
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
    setFormForceRegular(false);
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

  // ====== LEADERS ======
  const normalizeName = (s) => String(s || '').trim().toLowerCase();

  const saveLeadersToStorage = async (list) => {
    try {
      await AsyncStorage.setItem('@leaders_list', JSON.stringify(list));
    } catch (e) {
      console.log("Error saving leaders", e);
    }
  };

  // Members ng leader = mga Regular na ang Cell Leader ay kapareho ng pangalan ng leader
  const getLeaderMembers = (leader) =>
    regularList
      .filter(r => normalizeName(r.cellLeader) === normalizeName(leader.name))
      .sort((a, b) => a.name.localeCompare(b.name));

  // A-Z at naka-filter base sa search bar (pangalan ng leader)
  const sortedLeaders = [...leadersList]
    .filter(l => normalizeName(l.name).includes(normalizeName(leaderSearch)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleOpenAddLeader = () => {
    setEditLeaderId(null);
    setLName('');
    setLSex('');
    setLAge('');
    setLBirthday('');
    setLAddress('');
    setLContact('');
    setLeadersModalVisible(false);
    setLeaderFormVisible(true);
  };

  const handleOpenEditLeader = (leader) => {
    setEditLeaderId(leader.id);
    setLName(leader.name || '');
    setLSex(leader.sex && leader.sex !== 'N/A' ? leader.sex : '');
    setLAge(leader.age && leader.age !== 'N/A' ? String(leader.age) : '');
    setLBirthday(leader.birthday && leader.birthday !== 'N/A' ? leader.birthday : '');
    setLAddress(leader.address && leader.address !== 'N/A' ? leader.address : '');
    setLContact(leader.contact && leader.contact !== 'N/A' ? leader.contact : '');
    setLeadersModalVisible(false);
    setLeaderFormVisible(true);
  };

  const handleCancelLeaderForm = () => {
    setLeaderFormVisible(false);
    setLeaderDatePickerVisible(false);
    setLeadersModalVisible(true);
  };

  const handleLeaderDateChange = (event, selectedDate) => {
    setLeaderDatePickerVisible(false);
    if (selectedDate) {
      setLSelectedDate(selectedDate);
      setLBirthday(selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
  };

  const handleSaveLeader = () => {
    if (!lName.trim()) {
      Alert.alert("Error", "Please enter the Leader's Full Name.");
      return;
    }
    const duplicate = leadersList.some(
      l => l.id !== editLeaderId && normalizeName(l.name) === normalizeName(lName)
    );
    if (duplicate) {
      Alert.alert("Duplicate", "May leader na may ganitong pangalan.");
      return;
    }

    const data = {
      name: lName.trim(),
      sex: lSex || 'N/A',
      age: lAge || 'N/A',
      birthday: lBirthday || 'N/A',
      address: lAddress || 'N/A',
      contact: lContact || 'N/A',
    };

    let updatedLeaders;
    if (editLeaderId) {
      const old = leadersList.find(l => l.id === editLeaderId);
      updatedLeaders = leadersList.map(l => (l.id === editLeaderId ? { ...l, ...data } : l));

      // Kung pinalitan ang pangalan ng leader, i-update din ang Cell Leader ng mga members niya
      if (old && normalizeName(old.name) !== normalizeName(data.name)) {
        const updatedRegulars = regularList.map(r =>
          normalizeName(r.cellLeader) === normalizeName(old.name) ? { ...r, cellLeader: data.name } : r
        );
        setRegularList(updatedRegulars);
        saveDataToStorage(updatedRegulars, null, null, null);
      }
    } else {
      updatedLeaders = [{ id: Date.now().toString(), ...data }, ...leadersList];
    }

    setLeadersList(updatedLeaders);
    saveLeadersToStorage(updatedLeaders);
    setLeaderFormVisible(false);
    setLeaderDatePickerVisible(false);
    setLeadersModalVisible(true);
    Alert.alert("Success", editLeaderId ? "Successfully updated leader!" : "Successfully added leader!");
  };

  const handleDeleteLeader = (leader) => {
    const memberCount = getLeaderMembers(leader).length;
    Alert.alert(
      "Delete Leader",
      memberCount > 0
        ? `I-delete si ${leader.name}? Hindi made-delete ang ${memberCount} member(s) niya, mananatili sila sa Regular list.`
        : `I-delete si ${leader.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updated = leadersList.filter(l => l.id !== leader.id);
            setLeadersList(updated);
            saveLeadersToStorage(updated);
          }
        }
      ]
    );
  };

  // Awtomatikong gagawa ng leaders mula sa Cell Leader names ng mga Regular members
  const handleImportLeadersFromMembers = () => {
    const existing = new Set(leadersList.map(l => normalizeName(l.name)));
    const toAdd = [];
    regularList.forEach(r => {
      const nm = String(r.cellLeader || '').trim();
      const key = normalizeName(nm);
      if (!nm || key === 'n/a' || existing.has(key)) return;
      existing.add(key);
      toAdd.push({
        id: Date.now().toString() + Math.random(),
        name: nm,
        sex: 'N/A',
        age: 'N/A',
        birthday: 'N/A',
        address: 'N/A',
        contact: 'N/A',
      });
    });

    if (toAdd.length === 0) {
      Alert.alert("Auto-add", "Walang bagong leader na maidadagdag.");
      return;
    }
    const updated = [...toAdd, ...leadersList];
    setLeadersList(updated);
    saveLeadersToStorage(updated);
    Alert.alert("Auto-add ✅", `${toAdd.length} leader(s) ang naidagdag. I-edit sila para mailagay ang personal data.`);
  };

  // Member form: kung galing sa Leaders screen, babalik doon pagkatapos mag-save/cancel
  const closeMemberModal = () => {
    setModalVisible(false);
    if (returnToLeaders) {
      setReturnToLeaders(false);
      setLeadersModalVisible(true);
    }
  };

  const handleOpenAddMemberForLeader = (leader) => {
    setLeadersModalVisible(false);
    handleOpenAdd();
    setFormForceRegular(true);
    setCellLeader(leader.name);
    setReturnToLeaders(true);
  };

  const handleOpenEditMember = (member) => {
    setLeadersModalVisible(false);
    handleOpenEdit(member, true);
    setReturnToLeaders(true);
  };

  // PRINT LEADERS: lahat ng leaders (kung ano ang naka-filter sa search bar) kasama ang members nila
  const handlePrintLeaders = async () => {
    if (sortedLeaders.length === 0) {
      Alert.alert("No Records", "There are no leaders to print.");
      return;
    }
    try {
      const totalMembers = sortedLeaders.reduce((sum, l) => sum + getLeaderMembers(l).length, 0);
      const title = leaderSearch.trim() !== ''
        ? `Leaders & Members - "${leaderSearch.trim()}"`
        : 'Leaders & Members';

      const sections = sortedLeaders.map((leader, li) => {
        const members = getLeaderMembers(leader);
        const rows = members.length === 0
          ? `<tr><td colspan="6" style="text-align:center;color:#64748B;">No members yet</td></tr>`
          : members.map((m, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><b>${m.name}</b></td>
                <td>${m.sex} / ${getDisplayAge(m.age, m.birthday)}</td>
                <td>${m.birthday}</td>
                <td>${m.address}</td>
                <td>${m.dateFilledOut || 'N/A'}</td>
              </tr>
            `).join('');

        return `
          <div class="leader">
            <h3>${li + 1}. ${leader.name} <span class="count">(${members.length} member${members.length === 1 ? '' : 's'})</span></h3>
            <div class="info">
              ${leader.sex} / ${getDisplayAge(leader.age, leader.birthday) || 'N/A'}
              &nbsp;|&nbsp; B-Day: ${leader.birthday}
              &nbsp;|&nbsp; Address: ${leader.address}
              &nbsp;|&nbsp; Contact: ${leader.contact}
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Sex / Age</th>
                  <th>Birthday</th>
                  <th>Address</th>
                  <th>Date Filled Out</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      }).join('');

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #1E293B; }
              h2 { text-align: center; margin-bottom: 5px; }
              .summary { text-align: center; margin-bottom: 20px; font-size: 13px; color: #64748B; font-weight: bold; }
              .leader { margin-bottom: 22px; page-break-inside: avoid; }
              h3 { margin: 0 0 4px 0; font-size: 15px; color: #0F172A; }
              .count { font-size: 12px; color: #047857; font-weight: normal; }
              .info { font-size: 11px; color: #475569; margin-bottom: 6px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: left; font-size: 11px; }
              th { background-color: #0F172A; color: #FFF; }
              tr:nth-child(even) { background-color: #F8FAFC; }
            </style>
          </head>
          <body>
            <h2>IKONEK - ${title}</h2>
            <div class="summary">Total Leaders: ${sortedLeaders.length} | Total Members: ${totalMembers}</div>
            ${sections}
          </body>
        </html>
      `;
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      Alert.alert("Error", "Unable to print at the moment.");
    }
  };

  // Regular ba ang ine-edit / dinadagdag sa Add/Edit form?
  const isRegularForm = isEditing
    ? regularList.some(r => r.id === editId)
    : (formForceRegular || activeTab === 'Regular');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter the Full Name.");
      return;
    }

    const isAddingRegular = isRegularForm;
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
      if (isRegularForm) {
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
      closeMemberModal();
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

      closeMemberModal();
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
              Total Regulars: ${regularList.length} | Total Timers/Newbies: ${newbieList.length} | Overall Total: ${combined.length} | Present: ${combined.filter(i => i.isPresent).length}
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
                  <th>Present</th>
                </tr>
              </thead>
              <tbody>
                ${combined.map((item, index) => `
                  <tr style="${item.isPresent ? 'background-color:#D1FAE5;' : ''}">
                    <td>${index + 1}</td>
                    <td><b>${item.name}</b></td>
                    <td>${item.status}</td>
                    <td>${item.sex} / ${getDisplayAge(item.age, item.birthday)}</td>
                    <td>${item.birthday}</td>
                    <td>${item.address}</td>
                    <td>${item.status === 'Regular' ? item.cellLeader : item.invitedBy}</td>
                    <td>${item.dateFilledOut}</td>
                    <td style="text-align:center;">${item.isPresent ? '<b style="color:#047857;">&#10004; Present</b>' : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      await Print.printAsync({ html: htmlContent });
      // Pagkatapos ma-print: ilipat sa History ang mga Present at i-clear ang All list
      archiveAndClearAttendance();
    } catch (error) {
      Alert.alert("Error", "Unable to print at the moment.");
    }
  };

  // HISTORY: i-filter base sa date (o pangalan) na tinype sa search bar
  const filteredHistory = attendanceHistory.filter(log => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return (log.date || '').toLowerCase().includes(q) || (log.name || '').toLowerCase().includes(q);
  });

  // I-print ang History (kung ano ang naka-filter sa search bar)
  const handlePrintHistory = async () => {
    if (filteredHistory.length === 0) {
      Alert.alert("No Records", "There are no attendance records to print.");
      return;
    }
    try {
      const title = historySearch.trim() !== ''
        ? `Attendance Logs - ${historySearch.trim()}`
        : 'Attendance Logs - All Dates';
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
            <h2>IKONEK - ${title}</h2>
            <div class="summary">Total Records: ${filteredHistory.length}</div>
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
                  <th>Date</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${filteredHistory.map((log, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td><b>${log.name}</b></td>
                    <td>${log.status}</td>
                    <td>${log.sex} / ${log.age}</td>
                    <td>${log.birthday}</td>
                    <td>${log.address}</td>
                    <td>${log.leaderOrInvited}</td>
                    <td>${log.date}</td>
                    <td>${log.time}</td>
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
    // Sa All tab, nasa itaas ang mga present ngayong araw
    if (activeTab === 'All' && !!a.isPresent !== !!b.isPresent) {
      return a.isPresent ? -1 : 1;
    }
    return sortOrder === 'A-Z'
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name);
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
              scanLockRef.current = false; // i-reset ang lock bago buksan ang camera
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

          {/* LEADERS BUTTON */}
          <TouchableOpacity
            style={[styles.iconActionBtn, { backgroundColor: '#8B5CF6', borderColor: '#7C3AED' }]}
            onPress={() => setLeadersModalVisible(true)}
          >
            <Text style={[styles.iconBtnText, { color: '#FFF' }]}>👥 Leaders</Text>
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
              <Text style={[styles.tableHeaderCell, { flex: 0.9, color: theme.tableHeaderText }]}>Status</Text>
            </View>
            {combinedData.map((item, index) => {
              const isBday = isBirthdayToday(item.birthday);
              const displayAge = getDisplayAge(item.age, item.birthday);
              const presentNow = !!item.isPresent;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: theme.border },
                    index % 2 === 1 && { backgroundColor: theme.tableAlt },
                    presentNow && { backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' }
                  ]}
                >
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

                  <TouchableOpacity
                    style={{ flex: 0.9, justifyContent: 'center', alignSelf: 'stretch' }}
                    disabled={!presentNow}
                    onPress={() => handleUncheckPresent(item)}
                  >
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: presentNow ? '#34D399' : theme.textSub }}>
                      {presentNow ? '✅ Present' : '—'}
                    </Text>
                  </TouchableOpacity>
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
                    <View />
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

                  {/* BACK / UNDO: para sa Timers lang, kung namali ng Mark Present */}
                  {!isRegular && item.isPresent && (
                    <TouchableOpacity
                      style={styles.undoBtn}
                      onPress={() => handleUndoNewbiePresent(item)}
                    >
                      <Text style={styles.btnText}>↩ Undo</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.presentBtn, !isRegular && item.isPresent && styles.activePresentBtn]}
                    onPress={() => {
                      if (!isRegular) {
                        handleTogglePresentNewbie(item.id);
                      } else {
                        handleMarkPresentRegular(item.id);
                      }
                    }}
                  >
                    <Text style={styles.btnText}>
                      {!isRegular && item.isPresent ? "✅ Present" : "Mark Present"}
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
          onRequestClose={closeMemberModal}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>
                {isEditing ? 'Edit Record' : `Add New ${isRegularForm ? 'Regular' : 'Timer'} Member`}
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

                {isRegularForm ? (
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
                    onPress={closeMemberModal}
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

              <TextInput
                style={[styles.historySearchInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                placeholder="🔍 Search date (e.g. Oct 5, 2026)..."
                placeholderTextColor={theme.textSub}
                value={historySearch}
                onChangeText={setHistorySearch}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: theme.textSub }}>
                  Showing {filteredHistory.length} of {attendanceHistory.length} record(s)
                </Text>
                <TouchableOpacity style={styles.historyPrintBtn} onPress={handlePrintHistory}>
                  <Text style={styles.historyPrintBtnText}>🖨 Print</Text>
                </TouchableOpacity>
              </View>

              {filteredHistory.length === 0 ? (
                <Text style={[styles.noDataText, { color: theme.textSub, marginTop: 60 }]}>No attendance logs found.</Text>
              ) : (
                <View style={[styles.tableContainer, { flex: 1, backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={[styles.tableHeaderRow, { backgroundColor: theme.tableHeader, borderBottomColor: theme.border }]}>
                    <Text style={[styles.tableHeaderCell, { flex: 0.4, color: theme.tableHeaderText }]}>#</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.8, color: theme.tableHeaderText }]}>Name & Status</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2, color: theme.tableHeaderText }]}>Details</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2, color: theme.tableHeaderText }]}>Address</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2, color: theme.tableHeaderText }]}>Leader / Invited</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.1, color: theme.tableHeaderText }]}>Date</Text>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {filteredHistory.map((log, index) => (
                      <View
                        key={log.id}
                        style={[
                          styles.tableRow,
                          { borderBottomColor: theme.border },
                          index % 2 === 1 && { backgroundColor: theme.tableAlt }
                        ]}
                      >
                        <Text style={[styles.tableCell, { flex: 0.4, color: theme.textSub }]}>{index + 1}</Text>

                        <View style={{ flex: 1.8, justifyContent: 'center' }}>
                          <Text style={[styles.tableCell, { fontWeight: 'bold', color: theme.textMain }]}>{log.name}</Text>
                          <Text style={{ fontSize: 9, color: log.status === 'Regular' ? '#34D399' : '#F59E0B', marginTop: 1 }}>
                            {log.status}
                          </Text>
                        </View>

                        <View style={{ flex: 1.2, justifyContent: 'center' }}>
                          <Text style={[styles.tableCell, { fontSize: 9, color: theme.textMain }]}>{log.sex} • {log.age}</Text>
                          <Text style={[styles.tableCell, { fontSize: 8, color: theme.textSub }]}>{log.birthday}</Text>
                        </View>

                        <View style={{ flex: 1.2, justifyContent: 'center' }}>
                          <Text style={[styles.tableCell, { fontSize: 10, color: theme.textMain }]}>{log.address}</Text>
                        </View>

                        <View style={{ flex: 1.2, justifyContent: 'center' }}>
                          <Text style={[styles.tableCell, { fontSize: 10, color: '#38BDF8' }]}>{log.leaderOrInvited}</Text>
                        </View>

                        <View style={{ flex: 1.1, justifyContent: 'center' }}>
                          <Text style={[styles.tableCell, { fontSize: 9, fontWeight: 'bold', color: theme.textMain }]}>{log.date}</Text>
                          <Text style={[styles.tableCell, { fontSize: 8, color: theme.textSub }]}>{log.time}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
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

        {/* LEADERS MODAL */}
        <Modal
          visible={leadersModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setLeadersModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg, height: '88%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={[styles.modalTitle, { color: theme.textMain, marginBottom: 0 }]}>
                  👥 Leaders ({leadersList.length})
                </Text>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleOpenAddLeader}>
                  <Text style={styles.modalSaveText}>+ Add Leader</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  style={styles.historyPrintBtn}
                  onPress={handleImportLeadersFromMembers}
                >
                  <Text style={styles.historyPrintBtnText}>⚡ Auto-add leaders</Text>
                </TouchableOpacity>

                {/* PRINT LEADERS WITH MEMBERS */}
                <TouchableOpacity
                  style={[styles.historyPrintBtn, { backgroundColor: '#0369A1' }]}
                  onPress={handlePrintLeaders}
                >
                  <Text style={styles.historyPrintBtnText}>🖨 Print Leaders</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.historySearchInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                placeholder="🔍 Search leader name..."
                placeholderTextColor={theme.textSub}
                value={leaderSearch}
                onChangeText={setLeaderSearch}
              />

              <ScrollView showsVerticalScrollIndicator={false}>
                {sortedLeaders.length === 0 ? (
                  <Text style={[styles.noDataText, { color: theme.textSub, marginTop: 40 }]}>
                    {leaderSearch.trim() ? 'No leaders found.' : 'No leaders yet. Tap "+ Add Leader".'}
                  </Text>
                ) : (
                  sortedLeaders.map(leader => {
                    const members = getLeaderMembers(leader);
                    const leaderAge = getDisplayAge(leader.age, leader.birthday);
                    const isOpen = !!expandedLeaders[leader.id];
                    return (
                      <View
                        key={leader.id}
                        style={[styles.card, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                      >
                        <Text style={[styles.nameText, { color: theme.textMain }]}>{leader.name}</Text>
                        <Text style={[styles.infoText, { color: theme.textSub }]}>
                          {leader.sex} • {leaderAge || 'N/A'} • B-Day: {leader.birthday}
                        </Text>
                        <Text style={[styles.infoText, { color: theme.textSub }]}>Address: {leader.address}</Text>
                        <Text style={[styles.infoText, { color: theme.textSub }]}>Contact: {leader.contact}</Text>

                        <View style={styles.actionRow}>
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteLeader(leader)}>
                            <Text style={styles.btnText}>🗑 Delete</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEditLeader(leader)}>
                            <Text style={styles.btnText}>✏ Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.presentBtn, { backgroundColor: '#059669' }]}
                            onPress={() => handleOpenAddMemberForLeader(leader)}
                          >
                            <Text style={styles.btnText}>+ Add Member</Text>
                          </TouchableOpacity>
                        </View>

                        {/* OPEN / CLOSE para makita ang members */}
                        <TouchableOpacity
                          style={styles.toggleMembersBtn}
                          onPress={() => setExpandedLeaders(prev => ({ ...prev, [leader.id]: !prev[leader.id] }))}
                        >
                          <Text style={styles.countTextRegular}>Members ({members.length})</Text>
                          <Text style={{ color: theme.textSub, fontSize: 12, fontWeight: 'bold' }}>
                            {isOpen ? '▲ Close' : '▼ Open'}
                          </Text>
                        </TouchableOpacity>

                        {!isOpen ? null : members.length === 0 ? (
                          <Text style={[styles.infoText, { color: theme.textSub }]}>Wala pang member.</Text>
                        ) : (
                          members.map(m => (
                            <View key={m.id} style={[styles.memberRow, { borderTopColor: theme.border }]}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.tableCell, { fontWeight: 'bold', color: theme.textMain }]}>{m.name}</Text>
                                <Text style={[styles.infoText, { color: theme.textSub }]}>
                                  {m.sex} • {getDisplayAge(m.age, m.birthday)} • {m.birthday}
                                </Text>
                                <Text style={[styles.infoText, { color: theme.textSub }]}>{m.address}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity
                                  style={[styles.smallBtn, { backgroundColor: '#1E3A8A' }]}
                                  onPress={() => handleOpenEditMember(m)}
                                >
                                  <Text style={styles.btnText}>✏</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.smallBtn, { backgroundColor: '#7F1D1D' }]}
                                  onPress={() => handleDelete(m.id, true)}
                                >
                                  <Text style={styles.btnText}>🗑</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: '#3B82F6', width: '100%', marginTop: 12, alignItems: 'center' }]}
                onPress={() => setLeadersModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: '#FFF' }]}>Close Leaders</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ADD/EDIT LEADER MODAL */}
        <Modal
          visible={leaderFormVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={handleCancelLeaderForm}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>
                {editLeaderId ? 'Edit Leader' : 'Add New Leader'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Full Name *</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. Ate Macel"
                  placeholderTextColor={theme.textSub}
                  value={lName}
                  onChangeText={setLName}
                />
                <Text style={[styles.infoText, { color: theme.textSub, marginBottom: 10 }]}>
                  Tip: dapat kapareho ng nakasulat sa Cell Leader ng mga members para lumabas sila sa leader na ito.
                </Text>

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Sex</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. Male / Female"
                  placeholderTextColor={theme.textSub}
                  value={lSex}
                  onChangeText={setLSex}
                />

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Age</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. 25"
                  placeholderTextColor={theme.textSub}
                  keyboardType="numeric"
                  value={lAge}
                  onChangeText={setLAge}
                />

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Birthday</Text>
                <TouchableOpacity
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, justifyContent: 'center' }]}
                  onPress={() => setLeaderDatePickerVisible(true)}
                >
                  <Text style={{ color: lBirthday ? theme.textMain : theme.textSub }}>
                    {lBirthday || 'Select Birthday (Tap here)'}
                  </Text>
                </TouchableOpacity>

                {leaderDatePickerVisible && (
                  <DateTimePicker
                    value={lSelectedDate}
                    mode="date"
                    display="default"
                    onChange={handleLeaderDateChange}
                  />
                )}

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Address</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. Masbate City"
                  placeholderTextColor={theme.textSub}
                  value={lAddress}
                  onChangeText={setLAddress}
                />

                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Contact Number</Text>
                <TextInput
                  style={[styles.inputField, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                  placeholder="e.g. 09xx xxx xxxx"
                  placeholderTextColor={theme.textSub}
                  keyboardType="phone-pad"
                  value={lContact}
                  onChangeText={setLContact}
                />

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { backgroundColor: theme.border }]}
                    onPress={handleCancelLeaderForm}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveLeader}>
                    <Text style={styles.modalSaveText}>Save Leader</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  undoBtn: {
    backgroundColor: '#B45309',
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
  historySearchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    fontSize: 13,
  },
  historyPrintBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  historyPrintBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  toggleMembersBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
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